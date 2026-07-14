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
});

describe('environment validation', () => {
  it('parses a complete development environment', () => {
    expect(
      parseEnvironment({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/torkout',
        HOST: '127.0.0.1',
        LOG_LEVEL: 'info',
        NODE_ENV: 'development',
        PORT: '3100',
      }),
    ).toEqual({
      DATABASE_URL: 'postgresql://user:password@localhost:5432/torkout',
      HOST: '127.0.0.1',
      LOG_LEVEL: 'info',
      NODE_ENV: 'development',
      PORT: 3100,
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
});
