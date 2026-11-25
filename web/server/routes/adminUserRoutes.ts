import { Router } from 'express';
import type { UserRole, UserStatus } from '../../shared/domain/roleAccess.ts';
import {
  AuthValidationError,
  adminCreateUser,
  adminResetUserPassword,
  adminUpdateUser,
  listUsersForAdmin,
} from '../db/users.ts';
import { requireAuth, requireRoles, type AuthRequest } from '../middleware/auth.ts';

export function createAdminUserRouter(): Router {
  const router = Router();
  const requireAdmin = requireRoles('ADMIN');

  router.use(requireAuth, requireAdmin);

  router.get('/', async (_req: AuthRequest, res) => {
    try {
      const list = await listUsersForAdmin();
      res.json({ ok: true, users: list });
    } catch (err) {
      console.error('Admin list users error:', err);
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : '读取账号列表失败。',
      });
    }
  });

  router.post('/', async (req: AuthRequest, res) => {
    try {
      const created = await adminCreateUser({
        username: String(req.body?.username ?? ''),
        password: String(req.body?.password ?? ''),
        displayName:
          typeof req.body?.displayName === 'string' ? req.body.displayName : undefined,
        role: String(req.body?.role ?? 'WAREHOUSE') as UserRole,
      });
      res.status(201).json({ ok: true, user: created });
    } catch (err) {
      if (err instanceof AuthValidationError) {
        res.status(err.statusCode).json({ ok: false, error: err.message });
        return;
      }
      console.error('Admin create user error:', err);
      res.status(500).json({ ok: false, error: '新增员工账号失败，请稍后重试。' });
    }
  });

  router.patch('/:uid', async (req: AuthRequest, res) => {
    const actorUid = req.user?.uid;
    if (!actorUid) {
      res.status(401).json({ ok: false, error: '未登录' });
      return;
    }
    try {
      const updated = await adminUpdateUser({
        actorUid,
        targetUid: req.params.uid,
        displayName:
          typeof req.body?.displayName === 'string' ? req.body.displayName : undefined,
        role: req.body?.role !== undefined ? (String(req.body.role) as UserRole) : undefined,
        status:
          req.body?.status !== undefined ? (String(req.body.status) as UserStatus) : undefined,
      });
      res.json({ ok: true, user: updated });
    } catch (err) {
      if (err instanceof AuthValidationError) {
        res.status(err.statusCode).json({ ok: false, error: err.message });
        return;
      }
      console.error('Admin update user error:', err);
      res.status(500).json({ ok: false, error: '更新账号权限失败，请稍后重试。' });
    }
  });

  router.post('/:uid/reset-password', async (req: AuthRequest, res) => {
    try {
      await adminResetUserPassword({
        targetUid: req.params.uid,
        newPassword: String(req.body?.newPassword ?? ''),
      });
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof AuthValidationError) {
        res.status(err.statusCode).json({ ok: false, error: err.message });
        return;
      }
      console.error('Admin reset password error:', err);
      res.status(500).json({ ok: false, error: '重置密码失败，请稍后重试。' });
    }
  });

  return router;
}
