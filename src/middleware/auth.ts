import type { NextFunction, Request, Response } from 'express';
import { getOrCreateUser, verifyUserSession } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { isLocalSessionToken } from '../utils/passwordAuth.ts';

export const SESSION_COOKIE_NAME = 'wms_session';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name?: string | null;
  username?: string | null;
  authProvider: 'google' | 'password';
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  sessionToken?: string;
}

export function getCookieValue(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice('Bearer '.length).trim();
    if (bearer) return bearer;
  }
  const cookieToken = getCookieValue(req, SESSION_COOKIE_NAME);
  if (cookieToken) return cookieToken;
  return null;
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Max-Age=604800',
    isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractAuthToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: '未登录或缺少身份凭证，请重新登录。' });
    return;
  }

  // 1. Custom username/password opaque session token stored in Cloud SQL
  if (isLocalSessionToken(token)) {
    try {
      const profile = await verifyUserSession(token);
      if (!profile) {
        res.status(401).json({ ok: false, error: '登录会话已失效或已过期，请重新登录。' });
        return;
      }
      req.user = {
        uid: profile.uid,
        email: profile.email,
        name: profile.displayName,
        username: profile.username,
        authProvider: 'password',
      };
      req.sessionToken = token;
      next();
      return;
    } catch (error) {
      console.error('Failed to verify local session token:', error);
      res.status(503).json({ ok: false, error: '服务暂时不可用，请稍后重试。' });
      return;
    }
  }

  // 2. Firebase Auth Google ID token
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email || `${decodedToken.uid}@users.local`;
    const displayName =
      typeof decodedToken.name === 'string' ? decodedToken.name : null;

    await getOrCreateUser(decodedToken.uid, email, displayName);
    req.user = {
      uid: decodedToken.uid,
      email,
      name: displayName,
      username: null,
      authProvider: 'google',
    };
    next();
  } catch (error) {
    const isDbSyncError =
      error instanceof Error && error.message.includes('用户信息同步失败');
    if (isDbSyncError) {
      console.error('Failed to sync authenticated user:', error);
      res.status(503).json({ ok: false, error: '服务暂时不可用，请稍后重试。' });
      return;
    }
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ ok: false, error: '登录凭证已失效，请重新登录。' });
  }
};
