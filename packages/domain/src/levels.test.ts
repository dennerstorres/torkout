import { describe, expect, it } from 'vitest';

import { LEVEL_DEFINITIONS, evaluateLevels } from './levels.js';

function completedWeek(
  weekMonday: string,
  days: number[],
): Array<{
  localDate: string;
  status: 'completed';
  type: 'strength';
}> {
  return days.map((offset) => ({
    localDate: new Date(Date.parse(`${weekMonday}T00:00:00Z`) + offset * 86_400_000)
      .toISOString()
      .slice(0, 10),
    status: 'completed' as const,
    type: 'strength' as const,
  }));
}

describe('level definitions', () => {
  it('declares six ordered levels centred on consistency', () => {
    expect(LEVEL_DEFINITIONS.map((level) => level.name)).toEqual([
      'Iniciante I',
      'Iniciante II',
      'Iniciante III',
      'Consistente I',
      'Consistente II',
      'Consistente III',
    ]);
    for (let index = 1; index < LEVEL_DEFINITIONS.length; index += 1) {
      const previous = LEVEL_DEFINITIONS[index - 1]!;
      const current = LEVEL_DEFINITIONS[index]!;
      expect(current.criteria.concludedSessions).toBeGreaterThanOrEqual(
        previous.criteria.concludedSessions,
      );
      expect(current.criteria.regularWeeks).toBeGreaterThanOrEqual(previous.criteria.regularWeeks);
    }
  });

  it('never rewards pain, maximum effort or excessive volume', () => {
    const criteriaKeys = new Set(LEVEL_DEFINITIONS.flatMap((level) => Object.keys(level.criteria)));
    expect([...criteriaKeys].sort()).toEqual([
      'concludedSessions',
      'evolutionRecords',
      'longestStreak',
      'regularWeeks',
    ]);
  });
});

describe('evaluateLevels', () => {
  it('starts everyone at the first level with no history', () => {
    const evaluation = evaluateLevels({ measurementDates: [], sessions: [] });
    expect(evaluation.current.name).toBe('Iniciante I');
    expect(evaluation.current.achievedAt).toBeNull();
    expect(evaluation.next?.name).toBe('Iniciante II');
    expect(evaluation.progressToNext).toBe(0);
  });

  it('counts concluded sessions, regular weeks, streaks and evolution records', () => {
    const evaluation = evaluateLevels({
      measurementDates: ['2026-07-06', '2026-07-13'],
      sessions: [...completedWeek('2026-07-06', [0, 2, 4]), ...completedWeek('2026-07-13', [0, 2])],
    });
    expect(evaluation.metrics.concludedSessions).toBe(5);
    expect(evaluation.metrics.regularWeeks).toBe(2);
    expect(evaluation.metrics.longestStreak).toBe(5);
    expect(evaluation.metrics.currentStreak).toBe(5);
    expect(evaluation.metrics.evolutionRecords).toBe(2);
    expect(evaluation.current.name).toBe('Iniciante II');
  });

  it('records the date on which each level was reached', () => {
    const evaluation = evaluateLevels({
      measurementDates: ['2026-07-06'],
      sessions: completedWeek('2026-07-06', [0, 2, 4, 6]),
    });
    const beginnerTwo = evaluation.levels.find((level) => level.name === 'Iniciante II');
    expect(beginnerTwo?.achievedAt).toBe('2026-07-12');
    expect(evaluation.levels[0]?.achievedAt).toBe('2026-07-06');
  });

  it('breaks the current streak on a missed session but keeps the best streak', () => {
    const evaluation = evaluateLevels({
      measurementDates: [],
      sessions: [
        { localDate: '2026-07-06', status: 'completed', type: 'strength' },
        { localDate: '2026-07-08', status: 'partial', type: 'strength' },
        { localDate: '2026-07-10', status: 'missed', type: 'strength' },
        { localDate: '2026-07-13', status: 'completed', type: 'strength' },
      ],
    });
    expect(evaluation.metrics.longestStreak).toBe(2);
    expect(evaluation.metrics.currentStreak).toBe(1);
  });

  it('ignores cancelled sessions and rest days in every metric', () => {
    const evaluation = evaluateLevels({
      measurementDates: [],
      sessions: [
        { localDate: '2026-07-06', status: 'completed', type: 'strength' },
        { localDate: '2026-07-07', status: 'cancelled', type: 'strength' },
        { localDate: '2026-07-08', status: 'planned', type: 'rest' },
        { localDate: '2026-07-09', status: 'completed', type: 'walk' },
      ],
    });
    expect(evaluation.metrics.concludedSessions).toBe(2);
    expect(evaluation.metrics.currentStreak).toBe(2);
  });

  it('lists achieved and remaining criteria for the next level', () => {
    const evaluation = evaluateLevels({
      measurementDates: ['2026-07-06'],
      sessions: completedWeek('2026-07-06', [0, 2]),
    });
    const next = evaluation.next;
    expect(next?.name).toBe('Iniciante II');
    expect(next?.criteria.find((item) => item.key === 'concludedSessions')).toMatchObject({
      achieved: false,
      target: 4,
      value: 2,
    });
    expect(next?.criteria.find((item) => item.key === 'evolutionRecords')).toMatchObject({
      achieved: true,
    });
    expect(evaluation.progressToNext).toBeGreaterThan(0);
    expect(evaluation.progressToNext).toBeLessThan(100);
  });
});
