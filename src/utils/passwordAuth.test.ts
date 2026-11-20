import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isLocalSessionToken,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyPassword,
} from './passwordAuth.ts';

test('validateUsername accepts valid custom usernames and rejects invalid inputs', () => {
  assert.equal(validateUsername('admin'), null);
  assert.equal(validateUsername('SMT_Op-01'), null);
  assert.equal(validateUsername('ops.lead@factory.com'), null);
  assert.equal(normalizeUsername('  SMT_Op-01  '), 'smt_op-01');

  assert.ok(validateUsername(''));
  assert.ok(validateUsername('ab'));
  assert.ok(validateUsername('bad user'));
  assert.ok(validateUsername('中文账号'));
});

test('validatePassword enforces minimum and maximum length', () => {
  assert.equal(validatePassword('123456'), null);
  assert.equal(validatePassword('StrongPass!2026'), null);
  assert.ok(validatePassword(''));
  assert.ok(validatePassword('12345'));
  assert.ok(validatePassword('a'.repeat(129)));
});

test('hashPassword and verifyPassword use unique scrypt salts and verify accurately', async () => {
  const hash1 = await hashPassword('MySecretPass123');
  const hash2 = await hashPassword('MySecretPass123');

  assert.ok(hash1.startsWith('scrypt$'));
  assert.notEqual(hash1, hash2);

  assert.equal(await verifyPassword('MySecretPass123', hash1), true);
  assert.equal(await verifyPassword('MySecretPass123', hash2), true);
  assert.equal(await verifyPassword('WrongPass123', hash1), false);
  assert.equal(await verifyPassword('MySecretPass123', 'invalid-hash'), false);
  assert.equal(await verifyPassword('MySecretPass123', null), false);
});

test('generateSessionToken produces prefixed high-entropy tokens with stable sha256 hashes', () => {
  const t1 = generateSessionToken();
  const t2 = generateSessionToken();

  assert.equal(isLocalSessionToken(t1), true);
  assert.equal(isLocalSessionToken('eyJhbGciOiJSUzI1NiJ9.firebase'), false);
  assert.notEqual(t1, t2);
  assert.equal(hashSessionToken(t1), hashSessionToken(t1));
  assert.notEqual(hashSessionToken(t1), hashSessionToken(t2));
  assert.equal(hashSessionToken(t1).length, 64);
});
