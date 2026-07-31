import { createDatabaseClient, migrateDatabase } from '@torkout/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuth } from './auth.js';
import type { AccountEmail, EmailSender } from './email.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

class RecordingEmailSender implements EmailSender {
  readonly messages: AccountEmail[] = [];

  async send(message: AccountEmail): Promise<void> {
    this.messages.push(message);
  }
}

const { db, pool } = createDatabaseClient(connectionString);
const emailSender = new RecordingEmailSender();
const origin = 'https://torkout.example.test';
const auth = createAuth({
  baseURL: origin,
  database: db,
  emailSender,
  // Esta suíte descreve a instância que habilita o cadastro público. O comportamento com o cadastro
  // fechado, que é o padrão do produto, está em `signup-closed.integration.test.ts`.
  publicSignUpEnabled: true,
  secret: 'test-only-secret-that-is-at-least-thirty-two-characters',
  trustedOrigins: [origin],
});

async function authRequest(
  path: string,
  body: Record<string, unknown>,
  options: { cookie?: string; ip?: string; origin?: string } = {},
): Promise<Response> {
  return auth.handler(
    new Request(`${origin}/auth${path}`, {
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        origin: options.origin ?? origin,
        ...(options.ip ? { 'x-forwarded-for': options.ip } : {}),
        ...(options.cookie ? { cookie: options.cookie } : {}),
      },
      method: 'POST',
    }),
  );
}

async function followEmail(message: AccountEmail): Promise<Response> {
  const ipSuffix =
    [...message.to].reduce((total, character) => total + character.charCodeAt(0), 0) % 200;
  return auth.handler(
    new Request(message.url, {
      headers: { origin, 'x-forwarded-for': `203.0.113.${ipSuffix + 1}` },
    }),
  );
}

async function registerAndVerify(email: string): Promise<void> {
  const ipSuffix =
    [...email].reduce((total, character) => total + character.charCodeAt(0), 0) % 200;
  const response = await authRequest(
    '/sign-up/email',
    {
      email,
      name: 'Pessoa Verificada',
      password: 'strong-password-123',
    },
    { ip: `198.51.100.${ipSuffix + 1}` },
  );
  expect(response.status).toBe(200);
  const verification = emailSender.messages.findLast(
    (message) => message.kind === 'verification' && message.to === email,
  );
  expect(verification).toBeDefined();
  const verifyResponse = await followEmail(verification!);
  expect([200, 302]).toContain(verifyResponse.status);
}

describe('Better Auth PostgreSQL integration', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('registers without a session, hashes the password with Argon2id and requires verification', async () => {
    const password = 'strong-password-123';
    const response = await authRequest('/sign-up/email', {
      email: 'new-user@example.invalid',
      name: 'Pessoa Nova',
      password,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(emailSender.messages.at(-1)).toMatchObject({
      kind: 'verification',
      to: 'new-user@example.invalid',
    });

    const account = await pool.query<{ password: string }>(
      "select password from accounts where provider_id = 'credential'",
    );
    expect(account.rows[0]!.password).toMatch(/^\$argon2id\$/);
    expect(account.rows[0]!.password).not.toContain(password);

    const signIn = await authRequest('/sign-in/email', {
      email: 'new-user@example.invalid',
      password,
    });
    expect(signIn.status).toBe(403);
  });

  it('rejects an untrusted origin before processing credentials', async () => {
    const response = await authRequest(
      '/sign-in/email',
      { email: 'unknown@example.invalid', password: 'does-not-matter' },
      { origin: 'https://evil.example.test' },
    );
    expect(response.status).toBe(403);
  });

  it('does not enumerate duplicate email addresses and consumes verification tokens once', async () => {
    const email = 'verification@example.invalid';
    await registerAndVerify(email);
    const verification = emailSender.messages.findLast(
      (message) => message.kind === 'verification' && message.to === email,
    )!;

    const reused = await followEmail(verification);
    expect(reused.status).toBe(401);

    const duplicate = await authRequest('/sign-up/email', {
      email,
      name: 'Outro nome',
      password: 'another-strong-password',
    });
    expect(duplicate.status).toBe(200);
    const users = await pool.query<{ count: number }>(
      'select count(*)::int as count from users where lower(email) = lower($1)',
      [email],
    );
    expect(users.rows[0]!.count).toBe(1);
  });

  it('issues a hardened cookie and supports listing and revoking the user sessions', async () => {
    const email = 'sessions@example.invalid';
    await registerAndVerify(email);
    const signIn = await authRequest(
      '/sign-in/email',
      { email, password: 'strong-password-123' },
      { ip: '192.0.2.20' },
    );

    expect(signIn.status).toBe(200);
    const setCookie = signIn.headers.get('set-cookie')!;
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    const cookie = setCookie.split(';', 1)[0]!;

    const listed = await auth.handler(
      new Request(`${origin}/auth/list-sessions`, { headers: { cookie, origin } }),
    );
    expect(listed.status).toBe(200);
    const sessionList = (await listed.json()) as Array<{ token: string }>;
    expect(sessionList).toHaveLength(1);

    const revoked = await authRequest(
      '/revoke-session',
      { token: sessionList[0]!.token },
      { cookie, ip: '192.0.2.20' },
    );
    expect(revoked.status).toBe(200);
    expect(
      await pool.query('select id from sessions where token = $1', [sessionList[0]!.token]),
    ).toHaveProperty('rowCount', 0);
  });

  it('prevents a blocked account from creating any new session', async () => {
    const email = 'blocked@example.invalid';
    await registerAndVerify(email);
    await pool.query(
      "update users set banned = true, ban_reason = 'Abuso confirmado' where email = $1",
      [email],
    );

    const response = await authRequest(
      '/sign-in/email',
      { email, password: 'strong-password-123' },
      { ip: '192.0.2.25' },
    );
    expect(response.status).toBe(403);
    const sessions = await pool.query<{ count: number }>(
      `select count(*)::int as count from sessions s
       join users u on u.id = s.user_id where u.email = $1`,
      [email],
    );
    expect(sessions.rows[0]!.count).toBe(0);
  });

  it('uses a short-lived reset token and revokes active sessions after password reset', async () => {
    const email = 'reset@example.invalid';
    await registerAndVerify(email);
    const signIn = await authRequest(
      '/sign-in/email',
      { email, password: 'strong-password-123' },
      { ip: '192.0.2.30' },
    );
    expect(signIn.status).toBe(200);

    const requested = await authRequest(
      '/request-password-reset',
      { email, redirectTo: `${origin}/reset-password` },
      { ip: '192.0.2.31' },
    );
    expect(requested.status).toBe(200);
    const resetMessage = emailSender.messages.findLast(
      (message) => message.kind === 'password-reset' && message.to === email,
    );
    expect(resetMessage).toBeDefined();
    const resetUrl = new URL(resetMessage!.url);
    const token = resetUrl.pathname.split('/').at(-1);
    expect(token).toBeTruthy();

    const reset = await authRequest(
      '/reset-password',
      { newPassword: 'new-strong-password-456', token },
      { ip: '192.0.2.31' },
    );
    expect(reset.status).toBe(200);
    const remaining = await pool.query<{ count: number }>(
      `select count(*)::int as count from sessions s
       join users u on u.id = s.user_id where u.email = $1`,
      [email],
    );
    expect(remaining.rows[0]!.count).toBe(0);

    const reused = await authRequest(
      '/reset-password',
      { newPassword: 'third-strong-password-789', token },
      { ip: '192.0.2.31' },
    );
    expect(reused.status).toBe(400);
  });

  it('rejects an expired password reset token', async () => {
    const email = 'expired-reset@example.invalid';
    await registerAndVerify(email);
    await authRequest(
      '/request-password-reset',
      { email, redirectTo: `${origin}/reset-password` },
      { ip: '192.0.2.35' },
    );
    const resetMessage = emailSender.messages.findLast(
      (message) => message.kind === 'password-reset' && message.to === email,
    )!;
    const token = new URL(resetMessage.url).pathname.split('/').at(-1)!;
    await pool.query("update verifications set expires_at = now() - interval '1 second'");

    const expired = await authRequest(
      '/reset-password',
      { newPassword: 'new-strong-password-456', token },
      { ip: '192.0.2.35' },
    );
    expect(expired.status).toBe(400);
  });

  it('reauthenticates with the password before deleting the account and its sessions', async () => {
    const email = 'delete-account@example.invalid';
    await registerAndVerify(email);
    const signIn = await authRequest(
      '/sign-in/email',
      { email, password: 'strong-password-123' },
      { ip: '192.0.2.36' },
    );
    const cookie = signIn.headers.get('set-cookie')!.split(';', 1)[0]!;

    await expect(
      auth.api.deleteUser({
        body: { password: 'wrong-password' },
        headers: new Headers({ cookie, origin }),
      }),
    ).rejects.toBeDefined();
    await auth.api.deleteUser({
      body: { password: 'strong-password-123' },
      headers: new Headers({ cookie, origin }),
    });
    const account = await pool.query('select id from users where email = $1', [email]);
    expect(account.rowCount).toBe(0);
  });

  it('temporarily rate limits repeated login attempts', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push(
        (
          await authRequest(
            '/sign-in/email',
            {
              email: 'rate-limit@example.invalid',
              password: 'wrong-password',
            },
            { ip: '192.0.2.40' },
          )
        ).status,
      );
    }
    expect(statuses.at(-1)).toBe(429);
  });
});
