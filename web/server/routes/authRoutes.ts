import { Router } from 'express';
import {
  AuthValidationError,
  authenticateLocalUser,
  bootstrapInitialAdmin,
  changeLocalUserPassword,
  hasActiveAdmin,
  revokeUserSession,
} from '../db/users.ts';
import {
  clearSessionCookie,
  extractAuthToken,
  requireAuth,
  setSessionCookie,
  type AuthRequest,
} from '../middleware/auth.ts';
import { isLocalSessionToken } from '../utils/passwordAuth.ts';

export function createAuthRouter(): Router {
  const router = Router();

  // First-party internal username/password authentication routes (Public self-registration is strictly disabled)
  router.get('/bootstrap-status', async (_req, res) => {
    const adminExists = await hasActiveAdmin();
    res.json({ ok: true, needsInitialAdmin: !adminExists });
  });

  router.post('/bootstrap-admin', async (req, res) => {
    try {
      const result = await bootstrapInitialAdmin({
        username: String(req.body?.username ?? ''),
        password: String(req.body?.password ?? ''),
        displayName:
          typeof req.body?.displayName === 'string' ? req.body.displayName : undefined,
      });
      setSessionCookie(req, res, result.token);
      res.status(201).json({ ok: true, user: result.user, token: result.token });
    } catch (err) {
      if (err instanceof AuthValidationError) {
        res.status(err.statusCode).json({ ok: false, error: err.message });
        return;
      }
      console.error('Bootstrap admin error:', err);
      res.status(500).json({ ok: false, error: '管理员初始化失败，请稍后重试。' });
    }
  });

  router.post('/register', (_req, res) => {
    res.status(403).json({
      ok: false,
      error: '系统已关闭公开注册，请联系系统管理员在「权限与账号管理」中为您开设岗位账号。',
    });
  });

  router.post('/login', async (req, res) => {
    try {
      const result = await authenticateLocalUser({
        username: String(req.body?.username ?? ''),
        password: String(req.body?.password ?? ''),
      });
      setSessionCookie(req, res, result.token);
      res.json({ ok: true, user: result.user, token: result.token });
    } catch (err) {
      if (err instanceof AuthValidationError) {
        res.status(err.statusCode).json({ ok: false, error: err.message });
        return;
      }
      console.error('Login error:', err);
      res.status(500).json({ ok: false, error: '登录失败，请稍后重试。' });
    }
  });

  router.post('/logout', async (req, res) => {
    const token = extractAuthToken(req);
    if (token && isLocalSessionToken(token)) {
      await revokeUserSession(token);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req: AuthRequest, res) => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: '未登录' });
      return;
    }
    res.json({
      ok: true,
      user: {
        uid: req.user.uid,
        username: req.user.username ?? null,
        email: req.user.email,
        displayName: req.user.name ?? req.user.username ?? req.user.email,
        role: req.user.role,
        status: req.user.status,
        authProvider: req.user.authProvider,
      },
    });
  });

  router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ ok: false, error: '未登录，请重新登录。' });
      return;
    }
    try {
      await changeLocalUserPassword({
        uid,
        currentPassword: String(req.body?.currentPassword ?? ''),
        newPassword: String(req.body?.newPassword ?? ''),
      });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof AuthValidationError) {
        res.status(err.statusCode).json({ ok: false, error: err.message });
        return;
      }
      console.error('Change password error:', err);
      res.status(500).json({ ok: false, error: '修改密码失败，请稍后重试。' });
    }
  });

  return router;
}
