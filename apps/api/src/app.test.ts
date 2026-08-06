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

  it('applies production security headers without exposing implementation details', async () => {
    const app = buildApp(undefined, { production: true });

    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    await app.close();
  });

  it('reports readiness only while the essential database dependency is available', async () => {
    const ready = buildApp(undefined, { readiness: async () => undefined });
    expect((await ready.inject({ method: 'GET', url: '/health/ready' })).json()).toEqual({
      status: 'ready',
    });
    await ready.close();

    const unavailable = buildApp(undefined, {
      readiness: async () => {
        throw new Error('connection details must remain private');
      },
    });
    const response = await unavailable.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'unavailable' });
    expect(response.body).not.toContain('connection details');
    await unavailable.close();
  });

  it('publishes aggregate Prometheus metrics without request content', async () => {
    const app = buildApp();
    await app.inject({ method: 'GET', url: '/health/live' });

    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('torkout_http_requests_total');
    expect(response.body).not.toContain('authorization');
    expect(response.body).not.toContain('cookie');
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
        OBJECT_STORAGE_DIR: './var/object-storage',
        PORT: '3100',
        SMTP_FROM: 'Torkout <no-reply@example.invalid>',
        SMTP_HOST: 'smtp.example.invalid',
        SMTP_PASSWORD: 'smtp-test-password',
        SMTP_PORT: '587',
        SMTP_SECURE: 'false',
        SMTP_USER: 'smtp-test-user',
        TRUST_PROXY: '127.0.0.1,10.0.0.0/8',
        TRUSTED_ORIGINS: 'https://torkout.example.test',
      }),
    ).toEqual({
      AUTH_BASE_URL: 'https://torkout.example.test',
      AUTH_SECRET: 'test-only-secret-that-is-at-least-thirty-two-characters',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/torkout',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'info',
      // Sem configuração explícita, a integração MCP nasce desligada.
      MCP_ENABLED: false,
      MCP_PUBLIC_URL: undefined,
      NODE_ENV: 'development',
      OBJECT_STORAGE_DIR: './var/object-storage',
      PORT: 3100,
      // Sem configuração explícita, o cadastro público nasce fechado.
      PUBLIC_SIGNUP_ENABLED: false,
      SMTP_FROM: 'Torkout <no-reply@example.invalid>',
      SMTP_HOST: 'smtp.example.invalid',
      SMTP_PASSWORD: 'smtp-test-password',
      SMTP_PORT: 587,
      SMTP_SECURE: false,
      SMTP_USER: 'smtp-test-user',
      TRUST_PROXY: ['127.0.0.1', '10.0.0.0/8'],
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
