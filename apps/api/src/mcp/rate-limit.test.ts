import { describe, expect, it } from 'vitest';

import { FixedWindowRateLimiter } from './rate-limit.js';

describe('FixedWindowRateLimiter', () => {
  it('accepts calls up to the limit', () => {
    const limiter = new FixedWindowRateLimiter(3, 60_000);
    expect(limiter.check('a', 0)).toBeNull();
    expect(limiter.check('a', 1)).toBeNull();
    expect(limiter.check('a', 2)).toBeNull();
  });

  it('refuses the call after the limit and reports the wait', () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000);
    limiter.check('a', 0);
    limiter.check('a', 0);
    expect(limiter.check('a', 0)).toBe(60);
  });

  it('opens a new window once the previous one expires', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    expect(limiter.check('a', 0)).toBeNull();
    expect(limiter.check('a', 1_000)).toBe(59);
    expect(limiter.check('a', 60_001)).toBeNull();
  });

  it('counts each key separately', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    expect(limiter.check('a', 0)).toBeNull();
    expect(limiter.check('b', 0)).toBeNull();
    expect(limiter.check('a', 0)).toBe(60);
  });
});
