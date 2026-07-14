import { describe, expect, it } from 'vitest';

import { progressAnalyticsResponseSchema, progressQuerySchema } from './analytics.js';

describe('progress analytics contracts', () => {
  it('accepts inclusive bounded ranges and rejects reversed or excessive ranges', () => {
    expect(progressQuerySchema.parse({ from: '2026-06-01', through: '2026-07-14' })).toEqual({
      from: '2026-06-01',
      through: '2026-07-14',
    });
    expect(
      progressQuerySchema.safeParse({ from: '2026-07-15', through: '2026-07-14' }).success,
    ).toBe(false);
    expect(
      progressQuerySchema.safeParse({ from: '2025-01-01', through: '2026-07-14' }).success,
    ).toBe(false);
  });

  it('validates explained analytics with nullable empty-week percentages', () => {
    expect(
      progressAnalyticsResponseSchema.safeParse({
        consistency: {
          explanation:
            'ConcluÃ­da vale 1, parcial vale 0,5 e perdida vale 0; descanso e cancelamento nÃ£o entram.',
          formulaVersion: 'weekly-consistency/v1',
          weeks: [
            {
              completedEquivalent: 0,
              percentage: null,
              plannedExecutable: 0,
              weekEnd: '2026-07-12',
              weekStart: '2026-07-06',
            },
          ],
        },
        exercises: [],
        measurements: [],
        pain: [],
        range: { from: '2026-07-06', through: '2026-07-12' },
        sessions: { completed: 0, partial: 0 },
        walks: { distanceMeters: 0, frequencyPerWeek: 0, sessions: 0 },
      }).success,
    ).toBe(true);
  });
});
