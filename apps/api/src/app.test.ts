import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { parseEnvironment } from './env.js';

describe('API smoke test', () => {
  it('answers the liveness probe without exposing internals', async () => {
    const app = buildApp();

    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });

  it('adapts Fastify requests and responses to the Better Auth fetch handler', async () => {
    let receivedRequest: Request | undefined;
    const app = buildApp({
      auth: {
        api: {
          deleteUser: async () => undefined,
          getSession: async () => null,
          verifyPassword: async () => undefined,
        },
        handler: async (request) => {
          receivedRequest = request;
          return Response.json(
            { status: true },
            { headers: { 'set-cookie': 'session=test; HttpOnly; Secure; SameSite=Lax' } },
          );
        },
      },
      database: {} as never,
      trustedOrigins: ['https://torkout.example.test'],
    });

    const response = await app.inject({
      headers: { origin: 'https://torkout.example.test' },
      method: 'POST',
      payload: { email: 'person@example.invalid' },
      url: '/auth/sign-in/email',
    });
    expect(receivedRequest?.url).toBe('https://torkout.example.test/auth/sign-in/email');
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toEqual([expect.stringContaining('HttpOnly')]);
    await app.close();
  });
});

describe('environment validation', () => {
  it('parses a complete development environment', () => {
    expect(
      parseEnvironment({
        AUTH_BASE_URL: 'https://torkout.example.test',
        AUTH_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters',
        DATABASE_URL: 'postgresql://user:password@localhost:5432/torkout',
        HOST: '127.0.0.1',
        LOG_LEVEL: 'info',
        NODE_ENV: 'development',
        PORT: '3100',
        SMTP_FROM: 'Torkout <no-reply@example.invalid>',
        SMTP_HOST: 'smtp.example.invalid',
        SMTP_PASSWORD: 'smtp-test-password',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'smtp-test-user',
        TRUSTED_ORIGINS: 'https://torkout.example.test',
      }),
    ).toEqual({
      AUTH_BASE_URL: 'https://torkout.example.test',
      AUTH_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/torkout',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'info',
      NODE_ENV: 'development',
      PORT: 3100,
      SMTP_FROM: 'Torkout <no-reply@example.invalid>',
      SMTP_HOST: 'smtp.example.invalid',
      SMTP_PASSWORD: 'smtp-test-password',
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: 'smtp-test-user',
      TRUSTED_ORIGINS: ['https://torkout.example.test'],
    });
  });

  it('rejects a missing database URL', () => {
    expect(() =>
      parseEnvironment({
        HOST: '127.0.0.1',
        LOG_LEVEL: 'info',
        NODE_ENV: 'development',
        PORT: '3100',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects production without authentication and SMTP secrets', () => {
    expect(() =>
      parseEnvironment({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/torkout',
        NODE_ENV: 'production',
      }),
    ).toThrow(/AUTH_SECRET|SMTP/);
  });
});
