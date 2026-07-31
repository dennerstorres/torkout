import { createDatabaseClient, migrateDatabase, users } from '@torkout/database';
import { eq } from 'drizzle-orm';
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
const secret = 'test-only-secret-that-is-at-least-thirty-two-characters';

/** Instância que ainda aceita cadastro; serve para semear a conta que já existia ao fechar. */
const openAuth = createAuth({
  baseURL: origin,
  database: db,
  emailSender,
  publicSignUpEnabled: true,
  secret,
  trustedOrigins: [origin],
});

/** Instância no padrão do produto: nenhuma opção de cadastro é passada. */
const closedAuth = createAuth({
  baseURL: origin,
  database: db,
  emailSender,
  secret,
  trustedOrigins: [origin],
});

const existingEmail = 'ja-cadastrada@example.invalid';
const unknownEmail = 'nunca-vista@example.invalid';
const password = 'strong-password-123';

function request(
  auth: ReturnType<typeof createAuth>,
  path: string,
  body: Record<string, unknown>,
  ip: string,
): Promise<Response> {
  return auth.handler(
    new Request(`${origin}/auth${path}`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': ip },
      method: 'POST',
    }),
  );
}

async function countUsers(email: string): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  return rows.length;
}

describe('public sign-up closed', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);

    const seeded = await request(
      openAuth,
      '/sign-up/email',
      { email: existingEmail, name: 'Pessoa Existente', password },
      '198.51.100.10',
    );
    expect(seeded.status).toBe(200);
    const verification = emailSender.messages.findLast(
      (message) => message.kind === 'verification' && message.to === existingEmail,
    );
    const verified = await openAuth.handler(
      new Request(verification!.url, { headers: { origin, 'x-forwarded-for': '198.51.100.11' } }),
    );
    expect([200, 302]).toContain(verified.status);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('refuses to create an account and persists nothing', async () => {
    const response = await request(
      closedAuth,
      '/sign-up/email',
      { email: unknownEmail, name: 'Pessoa Curiosa', password },
      '198.51.100.20',
    );

    expect(response.status).not.toBe(200);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await countUsers(unknownEmail)).toBe(0);
  });

  it('separates the refusal from authentication and from rate limiting', async () => {
    const response = await request(
      closedAuth,
      '/sign-up/email',
      { email: unknownEmail, name: 'Pessoa Curiosa', password },
      '198.51.100.21',
    );

    // A recusa precisa existir antes de ser distinguida: sem isto, um 200 passaria por vacuidade.
    expect(response.status).toBeGreaterThanOrEqual(400);
    // Recusa de cadastro não é credencial inválida nem excesso de tentativas.
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(429);
  });

  it('does not reveal whether the address already belongs to an account', async () => {
    const known = await request(
      closedAuth,
      '/sign-up/email',
      { email: existingEmail, name: 'Outra Pessoa', password },
      '198.51.100.22',
    );
    const unknown = await request(
      closedAuth,
      '/sign-up/email',
      { email: unknownEmail, name: 'Outra Pessoa', password },
      '198.51.100.23',
    );

    expect(known.status).toBe(unknown.status);
    expect(await known.text()).toBe(await unknown.text());
  });

  it('keeps sign-in working for an account created before sign-up closed', async () => {
    const response = await request(
      closedAuth,
      '/sign-in/email',
      { email: existingEmail, password },
      '198.51.100.24',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('keeps password recovery working without turning it into a way to register', async () => {
    const before = emailSender.messages.length;

    const known = await request(
      closedAuth,
      '/request-password-reset',
      { email: existingEmail, redirectTo: `${origin}/reset-password` },
      '198.51.100.25',
    );
    const unknown = await request(
      closedAuth,
      '/request-password-reset',
      { email: unknownEmail, redirectTo: `${origin}/reset-password` },
      '198.51.100.26',
    );

    expect(known.status).toBe(unknown.status);
    expect(await countUsers(unknownEmail)).toBe(0);
    expect(emailSender.messages.slice(before).some((message) => message.to === unknownEmail)).toBe(
      false,
    );
  });
});
