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

describe('mcp configuration', () => {
  it('keeps the integration disabled when the instance does not configure it', () => {
    expect(parseEnvironment({ ...baseEnvironment }).MCP_ENABLED).toBe(false);
  });

  it('enables the integration only for the explicit "true" value', () => {
    expect(parseEnvironment({ ...baseEnvironment, MCP_ENABLED: 'true' }).MCP_ENABLED).toBe(true);
    expect(parseEnvironment({ ...baseEnvironment, MCP_ENABLED: 'false' }).MCP_ENABLED).toBe(false);
  });

  it('rejects an ambiguous value instead of silently exposing the data', () => {
    expect(() => parseEnvironment({ ...baseEnvironment, MCP_ENABLED: 'yes' })).toThrow();
  });

  it('treats a declared but blank public url as unconfigured', () => {
    expect(
      parseEnvironment({ ...baseEnvironment, MCP_PUBLIC_URL: '' }).MCP_PUBLIC_URL,
    ).toBeUndefined();
  });

  it('rejects a public url that is not https outside localhost', () => {
    expect(() =>
      parseEnvironment({ ...baseEnvironment, MCP_PUBLIC_URL: 'http://torkout.example.test' }),
    ).toThrow();
  });

  it('accepts a dedicated https subdomain', () => {
    const environment = parseEnvironment({
      ...baseEnvironment,
      MCP_PUBLIC_URL: 'https://mcp.torkout.example.test',
    });
    expect(environment.MCP_PUBLIC_URL).toBe('https://mcp.torkout.example.test');
  });
});
