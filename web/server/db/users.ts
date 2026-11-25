import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, gt } from 'drizzle-orm';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyPassword,
} from '../utils/passwordAuth.ts';
import {
  normalizeUserRole,
  normalizeUserStatus,
  USER_ROLE_LIST,
  validateUserAdminMutation,
  type UserRole,
  type UserStatus,
} from '../../shared/domain/roleAccess.ts';
import { db } from './index.ts';
import { userCredentials, userSessions, users } from './schema.ts';

export class AuthValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AuthValidationError';
    this.statusCode = statusCode;
  }
}

export interface AuthUserProfile {
  uid: string;
  username: string | null;
  email: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  authProvider: 'password';
}

export interface AdminUserRecord {
  uid: string;
  username: string | null;
  email: string;
  displayName: string | null;
  role: UserRole;
  status: UserStatus;
  authProvider: 'password';
  createdAt: string;
  updatedAt: string;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function hasActiveAdmin(): Promise<boolean> {
  try {
    const rows = await db
      .select({ total: count() })
      .from(users)
      .innerJoin(userCredentials, eq(userCredentials.userUid, users.uid))
      .where(and(eq(users.role, 'ADMIN'), eq(users.status, 'ACTIVE')));
    return Number(rows[0]?.total ?? 0) > 0;
  } catch (error) {
    console.error('Database query failed in hasActiveAdmin:', error);
    return true;
  }
}

export async function createUserSession(userUid: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  try {
    await db.insert(userSessions).values({
      tokenHash,
      userUid,
      expiresAt,
    });
    return { token, expiresAt };
  } catch (error) {
    console.error('Database query failed in createUserSession:', error);
    throw new Error('登录会话创建失败，请稍后重试。', { cause: error });
  }
}

/**
 * One-time initial administrator setup for brand-new deployments with zero active admins.
 * Permanently locks itself once at least one active ADMIN exists in the database.
 */
export async function bootstrapInitialAdmin(input: {
  username: string;
  password: string;
  displayName?: string;
}): Promise<{ user: AuthUserProfile; token: string; expiresAt: Date }> {
  const usernameErr = validateUsername(input.username);
  if (usernameErr) {
    throw new AuthValidationError(usernameErr, 400);
  }
  const passwordErr = validatePassword(input.password);
  if (passwordErr) {
    throw new AuthValidationError(passwordErr, 400);
  }

  const username = normalizeUsername(input.username);
  const displayName = (input.displayName ?? '').trim() || username;
  const email = username.includes('@') ? username : `${username}@wms.local`;
  const passwordHash = await hashPassword(input.password);
  const uid = `local_${randomUUID()}`;

  try {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.transaction(async (tx) => {
      const adminRows = await tx
        .select({ total: count() })
        .from(users)
        .innerJoin(userCredentials, eq(userCredentials.userUid, users.uid))
        .where(and(eq(users.role, 'ADMIN'), eq(users.status, 'ACTIVE')));

      if (Number(adminRows[0]?.total ?? 0) > 0) {
        throw new AuthValidationError(
          '系统已完成管理员初始化，公开注册已关闭，请直接登录或联系管理员开设账号。',
          403
        );
      }

      const existing = await tx
        .select({ id: userCredentials.id })
        .from(userCredentials)
        .where(eq(userCredentials.username, username))
        .limit(1);

      if (existing.length > 0) {
        throw new AuthValidationError(
          `账号 "${username}" 已存在，请更换账号名。`,
          409
        );
      }

      await tx.insert(users).values({
        uid,
        email,
        displayName,
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      await tx.insert(userCredentials).values({
        userUid: uid,
        username,
        passwordHash,
      });

      await tx.insert(userSessions).values({
        tokenHash,
        userUid: uid,
        expiresAt,
      });
    });

    return {
      user: {
        uid,
        username,
        email,
        displayName,
        role: 'ADMIN',
        status: 'ACTIVE',
        authProvider: 'password',
      },
      token,
      expiresAt,
    };
  } catch (error) {
    if (error instanceof AuthValidationError) throw error;
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === '23505') {
      throw new AuthValidationError(`账号 "${username}" 已存在，请更换账号名。`, 409);
    }
    console.error('Database query failed in bootstrapInitialAdmin:', error);
    throw new Error('初始化管理员失败，请稍后重试。', { cause: error });
  }
}

export async function authenticateLocalUser(input: {
  username: string;
  password: string;
}): Promise<{ user: AuthUserProfile; token: string; expiresAt: Date }> {
  const username = normalizeUsername(input.username);
  if (!username || !input.password) {
    throw new AuthValidationError('请输入账号和密码', 400);
  }

  try {
    const rows = await db
      .select({
        user: users,
        credential: userCredentials,
      })
      .from(userCredentials)
      .innerJoin(users, eq(userCredentials.userUid, users.uid))
      .where(eq(userCredentials.username, username))
      .limit(1);

    if (rows.length === 0) {
      throw new AuthValidationError('账号或密码错误，请检查后重试。', 401);
    }

    const { user, credential } = rows[0];
    const valid = await verifyPassword(input.password, credential.passwordHash);
    if (!valid) {
      throw new AuthValidationError('账号或密码错误，请检查后重试。', 401);
    }

    const status = normalizeUserStatus(user.status);
    if (status === 'DISABLED') {
      throw new AuthValidationError('该账号已被管理员停用，请联系系统管理员处理。', 403);
    }

    const session = await createUserSession(user.uid);
    return {
      user: {
        uid: user.uid,
        username: credential.username,
        email: user.email,
        displayName: user.displayName ?? credential.username,
        role: normalizeUserRole(user.role),
        status,
        authProvider: 'password',
      },
      token: session.token,
      expiresAt: session.expiresAt,
    };
  } catch (error) {
    if (error instanceof AuthValidationError) throw error;
    console.error('Database query failed in authenticateLocalUser:', error);
    throw new Error('登录验证失败，请稍后重试。', { cause: error });
  }
}

export async function verifyUserSession(
  token: string
): Promise<AuthUserProfile | null> {
  const tokenHash = hashSessionToken(token);
  const now = new Date();

  try {
    const rows = await db
      .select({
        user: users,
        credential: userCredentials,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userUid, users.uid))
      .innerJoin(userCredentials, eq(userCredentials.userUid, users.uid))
      .where(
        and(
          eq(userSessions.tokenHash, tokenHash),
          gt(userSessions.expiresAt, now)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    const { user, credential } = rows[0];
    return {
      uid: user.uid,
      username: credential.username,
      email: user.email,
      displayName: user.displayName ?? credential.username,
      role: normalizeUserRole(user.role),
      status: normalizeUserStatus(user.status),
      authProvider: 'password',
    };
  } catch (error) {
    console.error('Database query failed in verifyUserSession:', error);
    throw new Error('会话验证失败，请稍后重试。', { cause: error });
  }
}

export async function revokeUserSession(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  try {
    await db.delete(userSessions).where(eq(userSessions.tokenHash, tokenHash));
  } catch (error) {
    console.error('Database query failed in revokeUserSession:', error);
  }
}

export async function changeLocalUserPassword(input: {
  uid: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const newPassErr = validatePassword(input.newPassword);
  if (newPassErr) {
    throw new AuthValidationError(newPassErr, 400);
  }

  try {
    const [credential] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userUid, input.uid))
      .limit(1);

    if (!credential) {
      throw new AuthValidationError(
        '未找到该账号的本地登录凭证，请联系系统管理员处理。',
        400
      );
    }

    const ok = await verifyPassword(input.currentPassword, credential.passwordHash);
    if (!ok) {
      throw new AuthValidationError('当前密码不正确，请重新输入。', 400);
    }

    const nextHash = await hashPassword(input.newPassword);
    await db
      .update(userCredentials)
      .set({
        passwordHash: nextHash,
        updatedAt: new Date(),
      })
      .where(eq(userCredentials.userUid, input.uid));
  } catch (error) {
    if (error instanceof AuthValidationError) throw error;
    console.error('Database query failed in changeLocalUserPassword:', error);
    throw new Error('密码修改失败，请稍后重试。', { cause: error });
  }
}

// ============================================================
// Admin User & Role Management (RBAC)
// ============================================================

export async function listUsersForAdmin(): Promise<AdminUserRecord[]> {
  try {
    const rows = await db
      .select({
        user: users,
        username: userCredentials.username,
      })
      .from(users)
      .innerJoin(userCredentials, eq(userCredentials.userUid, users.uid))
      .orderBy(desc(users.createdAt));

    return rows.map(({ user, username }) => ({
      uid: user.uid,
      username,
      email: user.email,
      displayName: user.displayName ?? username ?? user.email,
      role: normalizeUserRole(user.role),
      status: normalizeUserStatus(user.status),
      authProvider: 'password',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('Database query failed in listUsersForAdmin:', error);
    throw new Error('读取账号列表失败，请稍后重试。', { cause: error });
  }
}

export async function adminCreateUser(input: {
  username: string;
  password: string;
  displayName?: string;
  role: UserRole;
}): Promise<AdminUserRecord> {
  const usernameErr = validateUsername(input.username);
  if (usernameErr) {
    throw new AuthValidationError(usernameErr, 400);
  }
  const passwordErr = validatePassword(input.password);
  if (passwordErr) {
    throw new AuthValidationError(passwordErr, 400);
  }
  if (!USER_ROLE_LIST.includes(input.role)) {
    throw new AuthValidationError(
      '岗位角色无效，请选择管理员、仓库、IQC、采购或生产。',
      400
    );
  }

  const username = normalizeUsername(input.username);
  const displayName = (input.displayName ?? '').trim() || username;
  const email = username.includes('@') ? username : `${username}@wms.local`;
  const passwordHash = await hashPassword(input.password);
  const uid = `local_${randomUUID()}`;
  const now = new Date();

  try {
    const existing = await db
      .select({ id: userCredentials.id })
      .from(userCredentials)
      .where(eq(userCredentials.username, username))
      .limit(1);

    if (existing.length > 0) {
      throw new AuthValidationError(`账号 "${username}" 已存在，请更换工号或用户名。`, 409);
    }

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        uid,
        email,
        displayName,
        role: input.role,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(userCredentials).values({
        userUid: uid,
        username,
        passwordHash,
        createdAt: now,
        updatedAt: now,
      });
    });

    return {
      uid,
      username,
      email,
      displayName,
      role: input.role,
      status: 'ACTIVE',
      authProvider: 'password',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  } catch (error) {
    if (error instanceof AuthValidationError) throw error;
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === '23505') {
      throw new AuthValidationError(`账号 "${username}" 已存在，请更换工号或用户名。`, 409);
    }
    console.error('Database query failed in adminCreateUser:', error);
    throw new Error('创建员工账号失败，请稍后重试。', { cause: error });
  }
}

export async function adminUpdateUser(input: {
  actorUid: string;
  targetUid: string;
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
}): Promise<AdminUserRecord> {
  if (input.role !== undefined && !USER_ROLE_LIST.includes(input.role)) {
    throw new AuthValidationError(
      '岗位角色无效，请选择管理员、仓库、IQC、采购或生产。',
      400
    );
  }
  if (
    input.status !== undefined &&
    input.status !== 'ACTIVE' &&
    input.status !== 'DISABLED'
  ) {
    throw new AuthValidationError('账号状态无效。', 400);
  }

  try {
    return await db.transaction(async (tx) => {
      const targetRows = await tx
        .select({
          user: users,
          username: userCredentials.username,
        })
        .from(users)
        .innerJoin(userCredentials, eq(userCredentials.userUid, users.uid))
        .where(eq(users.uid, input.targetUid))
        .limit(1);

      if (targetRows.length === 0) {
        throw new AuthValidationError('未找到该账号记录。', 404);
      }

      const { user: current, username } = targetRows[0];
      const currentRole = normalizeUserRole(current.role);
      const currentStatus = normalizeUserStatus(current.status);
      const nextRole = input.role ?? currentRole;
      const nextStatus = input.status ?? currentStatus;
      const nextDisplayName =
        input.displayName !== undefined
          ? input.displayName.trim() || username || current.email
          : current.displayName;

      const adminCountRows = await tx
        .select({ total: count() })
        .from(users)
        .innerJoin(userCredentials, eq(userCredentials.userUid, users.uid))
        .where(and(eq(users.role, 'ADMIN'), eq(users.status, 'ACTIVE')));
      const activeAdminCount = Number(adminCountRows[0]?.total ?? 0);

      const guardErr = validateUserAdminMutation({
        actorUid: input.actorUid,
        targetUid: input.targetUid,
        currentRole,
        currentStatus,
        nextRole,
        nextStatus,
        activeAdminCount,
      });
      if (guardErr) {
        throw new AuthValidationError(guardErr, 400);
      }

      const now = new Date();
      const [updated] = await tx
        .update(users)
        .set({
          displayName: nextDisplayName,
          role: nextRole,
          status: nextStatus,
          updatedAt: now,
        })
        .where(eq(users.uid, input.targetUid))
        .returning();

      // Immediately revoke active sessions when an account is disabled
      if (nextStatus === 'DISABLED') {
        await tx
          .delete(userSessions)
          .where(eq(userSessions.userUid, input.targetUid));
      }

      return {
        uid: updated.uid,
        username,
        email: updated.email,
        displayName: updated.displayName ?? username ?? updated.email,
        role: normalizeUserRole(updated.role),
        status: normalizeUserStatus(updated.status),
        authProvider: 'password',
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  } catch (error) {
    if (error instanceof AuthValidationError) throw error;
    console.error('Database query failed in adminUpdateUser:', error);
    throw new Error('更新账号权限失败，请稍后重试。', { cause: error });
  }
}

export async function adminResetUserPassword(input: {
  targetUid: string;
  newPassword: string;
}): Promise<void> {
  const passErr = validatePassword(input.newPassword);
  if (passErr) {
    throw new AuthValidationError(passErr, 400);
  }

  try {
    const [credential] = await db
      .select()
      .from(userCredentials)
      .where(eq(userCredentials.userUid, input.targetUid))
      .limit(1);

    if (!credential) {
      throw new AuthValidationError(
        '未找到该账号的本地登录凭证，无法重置密码。',
        400
      );
    }

    const nextHash = await hashPassword(input.newPassword);
    await db.transaction(async (tx) => {
      await tx
        .update(userCredentials)
        .set({
          passwordHash: nextHash,
          updatedAt: new Date(),
        })
        .where(eq(userCredentials.userUid, input.targetUid));

      await tx
        .delete(userSessions)
        .where(eq(userSessions.userUid, input.targetUid));
    });
  } catch (error) {
    if (error instanceof AuthValidationError) throw error;
    console.error('Database query failed in adminResetUserPassword:', error);
    throw new Error('重置密码失败，请稍后重试。', { cause: error });
  }
}
