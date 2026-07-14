import { describe, expect, it } from 'vitest';

import { materializeWorkoutSessions, type PlanningTemplate } from './planning.js';

const strengthTemplate: PlanningTemplate = {
  exercises: [
    {
      exerciseId: '10000000-0000-4000-8000-000000000010',
      name: 'Flexão',
      sets: [
        { setNumber: 1, targetRepetitions: 12 },
        { setNumber: 2, targetRepetitions: 12 },
      ],
      sortOrder: 0,
      trackingMetric: 'repetitions',
    },
  ],
  id: '10000000-0000-4000-8000-000000000020',
  name: 'Treino A',
  type: 'strength',
};

describe('workout planning materializer', () => {
  it('materializes Monday and Friday in the rule time zone and supports multiple sessions per date', () => {
    const sessions = materializeWorkoutSessions({
      existing: [],
      from: '2026-07-13',
      idFor: (key) => `id:${key}`,
      rules: [
        {
          id: 'rule-monday-evening',
          localTime: '18:30',
          template: strengthTemplate,
          timeZone: 'America/Cuiaba',
          validFrom: '2026-07-01',
          validUntil: null,
          weekday: 1,
        },
        {
          id: 'rule-monday-morning',
          localTime: '07:00',
          template: { ...strengthTemplate, id: 'template-morning', name: 'Treino cedo' },
          timeZone: 'America/Cuiaba',
          validFrom: '2026-07-01',
          validUntil: null,
          weekday: 1,
        },
        {
          id: 'rule-friday',
          localTime: '18:30',
          template: strengthTemplate,
          timeZone: 'America/Cuiaba',
          validFrom: '2026-07-01',
          validUntil: null,
          weekday: 5,
        },
      ],
      through: '2026-07-17',
    });

    expect(
      sessions.map(({ plannedLocalDate, suggestedLocalTime }) => [
        plannedLocalDate,
        suggestedLocalTime,
      ]),
    ).toEqual([
      ['2026-07-13', '07:00'],
      ['2026-07-13', '18:30'],
      ['2026-07-17', '18:30'],
    ]);
    expect(sessions[0]?.plannedInstant).toBe('2026-07-13T11:00:00Z');
  });

  it('is idempotent and snapshots template targets', () => {
    const first = materializeWorkoutSessions({
      existing: [],
      from: '2026-07-13',
      idFor: (key) => `id:${key}`,
      rules: [
        {
          id: 'rule-monday',
          localTime: '18:00',
          template: strengthTemplate,
          timeZone: 'America/Cuiaba',
          validFrom: '2026-07-01',
          validUntil: null,
          weekday: 1,
        },
      ],
      through: '2026-07-13',
    });
    const second = materializeWorkoutSessions({
      existing: first,
      from: '2026-07-13',
      idFor: (key) => `different:${key}`,
      rules: [
        {
          id: 'rule-monday',
          localTime: '18:00',
          template: {
            ...strengthTemplate,
            exercises: [
              {
                ...strengthTemplate.exercises[0]!,
                sets: [{ setNumber: 1, targetRepetitions: 20 }],
              },
            ],
          },
          timeZone: 'America/Cuiaba',
          validFrom: '2026-07-01',
          validUntil: null,
          weekday: 1,
        },
      ],
      through: '2026-07-13',
    });

    expect(second).toEqual(first);
    expect(first[0]?.exercises[0]?.sets).toEqual([
      { setNumber: 1, targetRepetitions: 12 },
      { setNumber: 2, targetRepetitions: 12 },
    ]);
  });

  it('applies a future-effective rule only to not-started future dates', () => {
    const sessions = materializeWorkoutSessions({
      existing: [
        {
          exercises: [],
          id: 'historical',
          plannedInstant: '2026-07-13T22:00:00Z',
          plannedLocalDate: '2026-07-13',
          scheduleRuleId: 'old-rule',
          source: 'scheduled',
          status: 'completed',
          suggestedLocalTime: '18:00',
          templateId: strengthTemplate.id,
          templateNameSnapshot: 'Treino antigo',
          timeZone: 'America/Cuiaba',
          type: 'strength',
        },
      ],
      from: '2026-07-13',
      idFor: (key) => `id:${key}`,
      rules: [
        {
          id: 'new-rule',
          localTime: '19:00',
          template: { ...strengthTemplate, name: 'Treino futuro' },
          timeZone: 'America/Cuiaba',
          validFrom: '2026-07-20',
          validUntil: null,
          weekday: 1,
        },
      ],
      through: '2026-07-20',
    });

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.templateNameSnapshot).toBe('Treino antigo');
    expect(sessions[1]).toMatchObject({
      plannedLocalDate: '2026-07-20',
      status: 'planned',
      templateNameSnapshot: 'Treino futuro',
    });
  });
});
