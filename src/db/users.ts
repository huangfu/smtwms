import { randomUUID } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyPassword,
} from '../utils/passwordAuth.ts';
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
  authProvider: 'google' | 'password';
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName: displayName ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('用户信息同步失败，请稍后重试。', { cause: error });
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

export async function registerLocalUser(input: {
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
    const existing = await db
      .select({ id: userCredentials.id })
      .from(userCredentials)
      .where(eq(userCredentials.username, username))
      .limit(1);

    if (existing.length > 0) {
      throw new AuthValidationError(
        `账号 "${username}" 已被注册，请直接登录或更换账号名。`,
        409
      );
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        uid,
        email,
        displayName,
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
        authProvider: 'password',
      },
      token,
      expiresAt,
    };
  } catch (error) {
    if (error instanceof AuthValidationError) throw error;
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === '23505') {
      throw new AuthValidationError(`账号 "${username}" 已被注册，请更换账号名。`, 409);
    }
    console.error('Database query failed in registerLocalUser:', error);
    throw new Error('账号注册失败，请稍后重试。', { cause: error });
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

    const session = await createUserSession(user.uid);
    return {
      user: {
        uid: user.uid,
        username: credential.username,
        email: user.email,
        displayName: user.displayName ?? credential.username,
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
        '当前账号为 Google 第三方登录账号，不支持修改本地密码。',
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
