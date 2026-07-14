import { describe, expect, it } from 'vitest';

import { evaluateOfflineAuthorization } from './offline-auth.js';

describe('offline authorization', () => {
  const lastAuthenticatedAt = new Date('2026-06-14T12:00:00.000Z');

  it('allows the local replica through the thirty-day boundary', () => {
    expect(
      evaluateOfflineAuthorization({
        lastAuthenticatedAt,
        now: new Date('2026-07-14T12:00:00.000Z'),
      }),
    ).toEqual({
      allowed: true,
      expiresAt: '2026-07-14T12:00:00.000Z',
      reason: 'valid',
    });
  });

  it('requires online revalidation after expiry without requesting local data deletion', () => {
    expect(
      evaluateOfflineAuthorization({
        lastAuthenticatedAt,
        now: new Date('2026-07-14T12:00:00.001Z'),
      }),
    ).toEqual({
      allowed: false,
      expiresAt: '2026-07-14T12:00:00.000Z',
      preserveLocalData: true,
      reason: 'expired',
    });
  });

  it('denies a device with no previous online authentication', () => {
    expect(evaluateOfflineAuthorization({ lastAuthenticatedAt: null })).toEqual({
      allowed: false,
      expiresAt: null,
      preserveLocalData: true,
      reason: 'missing',
    });
  });
});
