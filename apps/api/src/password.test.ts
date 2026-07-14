import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password.js';

describe('Argon2id password hashing', () => {
  it('creates a salted non-recoverable hash and verifies only the original password', async () => {
    const password = 'correct horse battery staple';
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).toMatch(/^\$argon2id\$/);
    expect(first).not.toContain(password);
    expect(second).not.toBe(first);
    await expect(verifyPassword({ hash: first, password })).resolves.toBe(true);
    await expect(verifyPassword({ hash: first, password: 'wrong password' })).resolves.toBe(false);
  });
});
