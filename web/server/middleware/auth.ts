import type { NextFunction, Request, Response } from 'express';
import { verifyUserSession } from '../db/users.ts';
import { isLocalSessionToken } from '../utils/passwordAuth.ts';
import {
  isApiRoleAllowed,
  USER_ROLE_META,
  type UserRole,
  type UserStatus,
} from '../../shared/domain/roleAccess.ts';

export const SESSION_COOKIE_NAME = 'wms_session';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name?: string | null;
  username?: string | null;
  role: UserRole;
  status: UserStatus;
  authProvider: 'password';
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
    isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax',
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
    isHttps ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractAuthToken(req);
  if (!token || !isLocalSessionToken(token)) {
    res.status(401).json({
      ok: false,
      error: '未登录或身份凭证无效，请使用工号和密码登录。',
    });
    return;
  }

  try {
    const profile = await verifyUserSession(token);
    if (!profile) {
      res.status(401).json({ ok: false, error: '登录会话已失效或已过期，请重新登录。' });
      return;
    }
    if (profile.status === 'DISABLED') {
      clearSessionCookie(req, res);
      res.status(403).json({
        ok: false,
        error: '该账号已被管理员停用，请联系系统管理员处理。',
      });
      return;
    }
    req.user = {
      uid: profile.uid,
      email: profile.email,
      name: profile.displayName,
      username: profile.username,
      role: profile.role,
      status: profile.status,
      authProvider: 'password',
    };
    req.sessionToken = token;
    next();
  } catch (error) {
    console.error('Failed to verify local session token:', error);
    res.status(503).json({ ok: false, error: '服务暂时不可用，请稍后重试。' });
  }
};

/**
 * Server-side RBAC middleware enforcing fixed department/admin roles on protected routes.
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) {
      res.status(401).json({ ok: false, error: '未登录，请重新登录。' });
      return;
    }
    if (!isApiRoleAllowed(role, allowedRoles)) {
      const currentLabel = USER_ROLE_META[role]?.label ?? role;
      const allowedLabels = allowedRoles
        .filter((r) => r !== 'ADMIN')
        .map((r) => USER_ROLE_META[r]?.label ?? r)
        .join(' / ');
      res.status(403).json({
        ok: false,
        error: allowedLabels
          ? `权限不足：当前岗位「${currentLabel}」无权执行此操作（仅限 ${allowedLabels} 或管理员）。`
          : `权限不足：当前岗位「${currentLabel}」无权访问系统管理接口（仅限系统管理员）。`,
      });
      return;
    }
    next();
  };
}
