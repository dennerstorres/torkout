import { describe, expect, it } from 'vitest';

import { habitEntryCreateSchema, painReportCreateSchema, workoutExecutionSchema } from './daily.js';

describe('daily tracking contracts', () => {
  it('keeps joint pain unknown until an explicit answer is recorded', () => {
    const base = { exercises: [] };
    expect(workoutExecutionSchema.parse(base).jointPainStatus).toBe('unknown');
    expect(workoutExecutionSchema.parse({ ...base, jointPainStatus: 'none' }).jointPainStatus).toBe(
      'none',
    );
  });

  it('allows only one actual metric in each set', () => {
    expect(
      workoutExecutionSchema.safeParse({
        exercises: [
          {
            id: 'c6100000-0000-4000-8000-000000000001',
            sets: [
              {
                actualDurationSeconds: 60,
                actualRepetitions: 12,
                completed: true,
                id: 'c6100000-0000-4000-8000-000000000002',
                setNumber: 1,
              },
            ],
            status: 'completed',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('requires a custom label for another pain region', () => {
    const report = {
      bodyRegion: 'other',
      exerciseStopped: false,
      intensity: 'light',
      localDate: '2026-07-14',
      moment: 'after',
      type: 'muscular',
    };
    expect(painReportCreateSchema.safeParse(report).success).toBe(false);
    expect(
      painReportCreateSchema.safeParse({ ...report, customBodyRegion: 'Panturrilha' }).success,
    ).toBe(true);
  });

  it('requires exactly one value for a habit entry, including boolean false', () => {
    const entry = {
      habitDefinitionId: 'c6200000-0000-4000-8000-000000000001',
      localDate: '2026-07-14',
    };
    expect(habitEntryCreateSchema.safeParse(entry).success).toBe(false);
    expect(habitEntryCreateSchema.safeParse({ ...entry, booleanValue: false }).success).toBe(true);
    expect(
      habitEntryCreateSchema.safeParse({
        ...entry,
        booleanValue: true,
        numericValue: 1,
      }).success,
    ).toBe(false);
  });
});
