import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';

describe('nominal operational load', () => {
  it('keeps the liveness p95 below 500 ms under bounded concurrency', async () => {
    const app = buildApp();
    const durations: number[] = [];
    const batches = Array.from({ length: 10 }, () =>
      Promise.all(
        Array.from({ length: 25 }, async () => {
          const startedAt = performance.now();
          const response = await app.inject({ method: 'GET', url: '/health/live' });
          durations.push(performance.now() - startedAt);
          expect(response.statusCode).toBe(200);
        }),
      ),
    );
    for (const batch of batches) await batch;
    durations.sort((left, right) => left - right);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1]!;
    expect(p95).toBeLessThan(500);
    await app.close();
  });
});
