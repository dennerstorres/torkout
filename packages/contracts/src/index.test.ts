import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './index.js';

describe('shared health response contract', () => {
  it('accepts only the public liveness payload', () => {
    expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({ status: 'ok' });
    expect(() => healthResponseSchema.parse({ status: 'ready' })).toThrow();
    expect(() => healthResponseSchema.parse({ status: 'ok', databaseUrl: 'secret' })).toThrow();
  });
});
