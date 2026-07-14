import { describe, expect, it } from 'vitest';

import { calculateProgressAnalytics } from './analytics.js';

describe('progress analytics', () => {
  it('calculates versioned weekly consistency with empty, partial, rest and cancelled weeks', () => {
    const result = calculateProgressAnalytics({
      from: '2026-06-29',
      through: '2026-07-19',
      measurements: [],
      painReports: [],
      sessions: [
        { exercises: [], localDate: '2026-06-29', status: 'completed', type: 'strength' },
        { exercises: [], localDate: '2026-07-01', status: 'partial', type: 'strength' },
        { exercises: [], localDate: '2026-07-02', status: 'missed', type: 'walk' },
        { exercises: [], localDate: '2026-07-03', status: 'planned', type: 'rest' },
        { exercises: [], localDate: '2026-07-04', status: 'cancelled', type: 'strength' },
      ],
    });

    expect(result.consistency.formulaVersion).toBe('weekly-consistency/v1');
    expect(result.consistency.weeks).toEqual([
      expect.objectContaining({
        completedEquivalent: 1.5,
        percentage: 50,
        plannedExecutable: 3,
        weekStart: '2026-06-29',
      }),
      expect.objectContaining({ percentage: null, plannedExecutable: 0, weekStart: '2026-07-06' }),
      expect.objectContaining({ percentage: null, plannedExecutable: 0, weekStart: '2026-07-13' }),
    ]);
  });

  it('uses inclusive dates and excludes skipped or removed sets from exercise totals', () => {
    const result = calculateProgressAnalytics({
      from: '2026-07-01',
      through: '2026-07-02',
      measurements: [],
      painReports: [],
      sessions: [
        {
          exercises: [
            {
              exerciseId: '00000000-0000-4000-8000-000000000001',
              metric: 'repetitions',
              name: 'FlexÃ£o',
              sets: [{ actualRepetitions: 12 }, { actualRepetitions: 10 }],
              status: 'completed',
            },
            {
              exerciseId: '00000000-0000-4000-8000-000000000002',
              metric: 'repetitions',
              name: 'Agachamento livre',
              sets: [{ actualRepetitions: 99 }],
              status: 'skipped',
            },
          ],
          localDate: '2026-07-01',
          status: 'completed',
          type: 'strength',
        },
        {
          exercises: [
            {
              exerciseId: '00000000-0000-4000-8000-000000000001',
              metric: 'repetitions',
              name: 'FlexÃ£o',
              sets: [{ actualRepetitions: 8 }, { actualRepetitions: 500, deleted: true }],
              status: 'stopped',
            },
          ],
          localDate: '2026-07-02',
          status: 'partial',
          type: 'strength',
        },
      ],
    });

    expect(result.exercises).toEqual([
      expect.objectContaining({
        name: 'FlexÃ£o',
        points: [
          { localDate: '2026-07-01', value: 22 },
          { localDate: '2026-07-02', value: 8 },
        ],
        total: 30,
      }),
    ]);
    expect(result.sessions).toEqual({ completed: 1, partial: 1 });
  });

  it('sums completed and partial walks and groups delayed pain by its civil date', () => {
    const result = calculateProgressAnalytics({
      from: '2026-07-06',
      through: '2026-07-19',
      measurements: [],
      painReports: [
        {
          bodyRegion: 'knee',
          createdAt: '2026-07-20T12:00:00Z',
          intensity: 'moderate',
          localDate: '2026-07-10',
          type: 'joint',
        },
        {
          bodyRegion: 'back',
          createdAt: '2026-07-05T12:00:00Z',
          intensity: 'light',
          localDate: '2026-07-05',
          type: 'muscular',
        },
      ],
      sessions: [
        {
          exercises: [],
          localDate: '2026-07-06',
          status: 'completed',
          type: 'walk',
          walkingDistanceMeters: 5000,
        },
        {
          exercises: [],
          localDate: '2026-07-13',
          status: 'partial',
          type: 'walk',
          walkingDistanceMeters: 2500,
        },
      ],
    });

    expect(result.walks).toEqual({ distanceMeters: 7500, frequencyPerWeek: 1, sessions: 2 });
    expect(result.pain).toEqual([
      { bodyRegion: 'knee', count: 1, intensity: 'moderate', type: 'joint' },
    ]);
  });

  it('keeps multiple body measurements ordered inside the inclusive range', () => {
    const result = calculateProgressAnalytics({
      from: '2026-07-01',
      through: '2026-07-02',
      measurements: [
        { localDate: '2026-06-30', measuredAt: '2026-06-30T22:00:00Z', weightKg: 82 },
        { localDate: '2026-07-01', measuredAt: '2026-07-01T20:00:00Z', waistCm: 91 },
        { localDate: '2026-07-01', measuredAt: '2026-07-01T10:00:00Z', weightKg: 80 },
        { localDate: '2026-07-02', measuredAt: '2026-07-02T10:00:00Z', weightKg: 79.5 },
      ],
      painReports: [],
      sessions: [],
    });

    expect(result.measurements).toEqual([
      {
        localDate: '2026-07-01',
        measuredAt: '2026-07-01T10:00:00Z',
        waistCm: null,
        weightKg: 80,
      },
      {
        localDate: '2026-07-01',
        measuredAt: '2026-07-01T20:00:00Z',
        waistCm: 91,
        weightKg: null,
      },
      {
        localDate: '2026-07-02',
        measuredAt: '2026-07-02T10:00:00Z',
        waistCm: null,
        weightKg: 79.5,
      },
    ]);
  });
});
