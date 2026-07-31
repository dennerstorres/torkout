import { describe, expect, it } from 'vitest';

import { parseEnvironment } from './env.js';

const baseEnvironment = {
  AUTH_BASE_URL: 'http://localhost:5173',
  AUTH_SECRET: 'a'.repeat(32),
  DATABASE_URL: 'postgresql://torkout:torkout@localhost:5432/torkout',
  SMTP_FROM: 'Torkout <no-reply@torkout.local>',
  SMTP_HOST: 'localhost',
  SMTP_PASSWORD: 'local',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  SMTP_USER: 'local',
  TRUSTED_ORIGINS: 'http://localhost:5173',
} satisfies Record<string, string>;

describe('public sign-up configuration', () => {
  it('keeps public sign-up disabled when the instance does not configure it', () => {
    const environment = parseEnvironment({ ...baseEnvironment });

    expect(environment.PUBLIC_SIGNUP_ENABLED).toBe(false);
  });

  it('enables public sign-up only for the explicit "true" value', () => {
    const enabled = parseEnvironment({ ...baseEnvironment, PUBLIC_SIGNUP_ENABLED: 'true' });
    const disabled = parseEnvironment({ ...baseEnvironment, PUBLIC_SIGNUP_ENABLED: 'false' });

    expect(enabled.PUBLIC_SIGNUP_ENABLED).toBe(true);
    expect(disabled.PUBLIC_SIGNUP_ENABLED).toBe(false);
  });

  it('rejects an ambiguous value instead of silently opening registration', () => {
    expect(() => parseEnvironment({ ...baseEnvironment, PUBLIC_SIGNUP_ENABLED: 'yes' })).toThrow();
  });
});
