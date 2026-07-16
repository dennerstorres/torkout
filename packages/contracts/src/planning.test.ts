import { describe, expect, it } from 'vitest';

import {
  exerciseCreateSchema,
  materializeSessionsSchema,
  trainingPlanCreateSchema,
  workoutSessionCreateSchema,
  workoutSessionUpdateSchema,
  workoutTemplateCreateSchema,
} from './planning.js';

describe('planning contracts', () => {
  it('validates custom exercises and active plan validity', () => {
    expect(
      exerciseCreateSchema.parse({
        category: 'Força',
        instructions: 'Movimento controlado.',
        name: 'Remada',
        trackingMetric: 'repetitions',
      }),
    ).toMatchObject({ active: true, name: 'Remada' });
    expect(
      trainingPlanCreateSchema.safeParse({
        name: 'Plano inválido',
        status: 'active',
        validFrom: '2026-07-20',
        validUntil: '2026-07-19',
      }).success,
    ).toBe(false);
  });

  it('requires set targets to match the exercise metric', () => {
    const base = {
      exercises: [
        {
          exerciseId: '10000000-0000-4000-8000-000000000010',
          name: 'Caminhada',
          sets: [{ setNumber: 1, targetRepetitions: 10 }],
          sortOrder: 0,
          trackingMetric: 'distance',
        },
      ],
      name: 'Caminhada curta',
      planId: '10000000-0000-4000-8000-000000000020',
      rules: [
        {
          id: '10000000-0000-4000-8000-000000000030',
          localTime: '18:00',
          timeZone: 'America/Cuiaba',
          validFrom: '2026-07-20',
          validUntil: null,
          weekday: 1,
        },
      ],
      type: 'walk',
    };

    expect(workoutTemplateCreateSchema.safeParse(base).success).toBe(false);
    expect(
      workoutTemplateCreateSchema.safeParse({
        ...base,
        exercises: [
          {
            ...base.exercises[0],
            sets: [{ setNumber: 1, targetDistanceMeters: 5_000 }],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('accepts ad-hoc sessions and bounded materialization windows', () => {
    expect(
      workoutSessionCreateSchema.safeParse({
        exercises: [],
        plannedLocalDate: '2026-07-14',
        source: 'ad_hoc',
        suggestedLocalTime: '20:00',
        templateNameSnapshot: 'Sessão avulsa',
        timeZone: 'America/Cuiaba',
        type: 'other',
      }).success,
    ).toBe(true);
    expect(
      materializeSessionsSchema.safeParse({ from: '2026-07-01', through: '2027-07-01' }).success,
    ).toBe(false);
  });

  it('accepts complete composition changes for a planned ad-hoc session', () => {
    expect(
      workoutSessionUpdateSchema.safeParse({
        exercises: [
          {
            exerciseId: '10000000-0000-4000-8000-000000000010',
            name: 'Flexão inclinada',
            sets: [{ setNumber: 1, targetRepetitions: 15 }],
            sortOrder: 0,
            trackingMetric: 'repetitions',
          },
        ],
        notes: null,
        plannedLocalDate: '2026-07-20',
        templateNameSnapshot: 'Treino avulso editado',
        type: 'strength',
        version: 2,
      }).success,
    ).toBe(true);
  });
});
