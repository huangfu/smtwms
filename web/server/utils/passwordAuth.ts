import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export const LOCAL_SESSION_PREFIX = 'wms_sess_';
const SCRYPT_KEY_LEN = 64;
const USERNAME_REGEX = /^[a-zA-Z0-9._@-]{3,32}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const normalized = normalizeUsername(raw);
  if (!normalized) {
    return '请输入账号名称';
  }
  if (normalized.length < 3 || normalized.length > 32) {
    return '账号长度需在 3 - 32 个字符之间';
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return '账号仅支持字母、数字及 . _ - @ 符号';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return '请输入登录密码';
  }
  if (password.length < 6) {
    return '密码长度不能少于 6 位';
  }
  if (password.length > 128) {
    return '密码长度不能超过 128 位';
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, SCRYPT_KEY_LEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!storedHash || !password) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return `${LOCAL_SESSION_PREFIX}${randomBytes(32).toString('hex')}`;
}

export function isLocalSessionToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.startsWith(LOCAL_SESSION_PREFIX);
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
