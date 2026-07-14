import { describe, expect, it } from 'vitest';

import { buildCalendarMonth, effectiveHistoryStatus, historyDayMatchesFilters } from './history.js';

describe('calendar history rules', () => {
  it('derives missed only for executable planned sessions in the past', () => {
    expect(
      effectiveHistoryStatus(
        { plannedLocalDate: '2026-07-13', status: 'planned', type: 'strength' },
        '2026-07-14',
      ),
    ).toEqual({ derived: true, status: 'missed' });
    expect(
      effectiveHistoryStatus(
        { plannedLocalDate: '2026-07-13', status: 'planned', type: 'rest' },
        '2026-07-14',
      ),
    ).toEqual({ derived: false, status: 'planned' });
    expect(
      effectiveHistoryStatus(
        { plannedLocalDate: '2026-07-13', status: 'cancelled', type: 'strength' },
        '2026-07-14',
      ),
    ).toEqual({ derived: false, status: 'cancelled' });
  });

  it('builds a Monday-first month grid with stable civil dates', () => {
    const days = buildCalendarMonth('2026-07');
    expect(days).toHaveLength(35);
    expect(days[0]).toMatchObject({ inMonth: false, localDate: '2026-06-29' });
    expect(days.at(-1)).toMatchObject({ inMonth: false, localDate: '2026-08-02' });
  });

  it('combines activity, status and pain filters on the same day and session', () => {
    const day = {
      hasPain: true,
      sessions: [
        { status: 'completed' as const, type: 'walk' as const },
        { status: 'partial' as const, type: 'strength' as const },
      ],
    };
    expect(
      historyDayMatchesFilters(day, {
        activityTypes: ['strength'],
        pain: 'with',
        statuses: ['partial'],
      }),
    ).toBe(true);
    expect(
      historyDayMatchesFilters(day, {
        activityTypes: ['strength'],
        pain: 'with',
        statuses: ['completed'],
      }),
    ).toBe(false);
  });
});
