import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZATION_CODE_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  hashCredential,
  issueCredential,
  normalizeRequestedScope,
  verifyPkce,
  validateRedirectUri,
} from './oauth.js';

function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

describe('issueCredential', () => {
  it('produces high entropy opaque values that never repeat', () => {
    const values = new Set(Array.from({ length: 200 }, () => issueCredential()));
    expect(values.size).toBe(200);
    for (const value of values) {
      expect(value.length).toBeGreaterThanOrEqual(43);
      expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });
});

describe('hashCredential', () => {
  it('is deterministic and never returns the plain value', () => {
    const credential = issueCredential();
    const hash = hashCredential(credential);
    expect(hash).toBe(hashCredential(credential));
    expect(hash).not.toBe(credential);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different credentials', () => {
    expect(hashCredential('a')).not.toBe(hashCredential('b'));
  });
});

describe('verifyPkce', () => {
  it('accepts the verifier that produced the challenge', () => {
    const verifier = randomBytes(32).toString('base64url');
    expect(verifyPkce(challengeFor(verifier), 'S256', verifier)).toBe(true);
  });

  it('rejects a wrong verifier', () => {
    const verifier = randomBytes(32).toString('base64url');
    expect(verifyPkce(challengeFor(verifier), 'S256', 'not-the-verifier')).toBe(false);
  });

  it('rejects a missing verifier', () => {
    const verifier = randomBytes(32).toString('base64url');
    expect(verifyPkce(challengeFor(verifier), 'S256', undefined)).toBe(false);
  });

  it('refuses the plain method even when the values match', () => {
    expect(verifyPkce('abc', 'plain', 'abc')).toBe(false);
  });
});

describe('validateRedirectUri', () => {
  it('accepts an exactly registered uri', () => {
    expect(
      validateRedirectUri(
        ['https://chatgpt.com/connector_platform_oauth_redirect'],
        'https://chatgpt.com/connector_platform_oauth_redirect',
      ),
    ).toBe(true);
  });

  it('rejects a uri that only shares a prefix', () => {
    expect(
      validateRedirectUri(['https://chatgpt.com/callback'], 'https://chatgpt.com/callback.evil'),
    ).toBe(false);
  });

  it('rejects an unregistered host', () => {
    expect(
      validateRedirectUri(['https://chatgpt.com/callback'], 'https://evil.test/callback'),
    ).toBe(false);
  });

  it('defaults to the first registered uri when none is requested', () => {
    expect(validateRedirectUri(['https://chatgpt.com/callback'], undefined)).toBe(true);
  });
});

describe('normalizeRequestedScope', () => {
  it('accepts the single supported scope', () => {
    expect(normalizeRequestedScope('torkout:read')).toBe('torkout:read');
  });

  it('defaults to the read scope when none is requested', () => {
    expect(normalizeRequestedScope(undefined)).toBe('torkout:read');
  });

  it('refuses a scope the server does not grant', () => {
    expect(() => normalizeRequestedScope('torkout:write')).toThrow();
    expect(() => normalizeRequestedScope('torkout:read torkout:write')).toThrow();
  });
});

describe('credential lifetimes', () => {
  it('keeps the authorization code short lived', () => {
    expect(AUTHORIZATION_CODE_TTL_SECONDS).toBeLessThanOrEqual(600);
  });

  it('expires access tokens well before refresh tokens', () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBeLessThan(REFRESH_TOKEN_TTL_SECONDS);
  });
});
