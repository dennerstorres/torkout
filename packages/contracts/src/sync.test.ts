import { describe, expect, it } from 'vitest';

import {
  bodyMeasurementCreatePayloadSchema,
  syncOperationSchema,
  syncPushRequestSchema,
} from './sync.js';

const operation = {
  baseVersion: null,
  clientOccurredAt: '2026-07-14T15:00:00.000Z',
  deviceId: '30000000-0000-4000-8000-000000000001',
  entityId: '40000000-0000-4000-8000-000000000001',
  entityType: 'body_measurement',
  operation: 'create',
  operationId: '50000000-0000-4000-8000-000000000001',
  payload: {
    localDate: '2026-07-14',
    measuredAt: '2026-07-14T15:00:00.000Z',
    weightKg: 70,
  },
};

describe('sync contracts', () => {
  it('accepts a body measurement containing only extensible circumferences', () => {
    expect(
      bodyMeasurementCreatePayloadSchema.parse({
        additionalMeasurements: [
          { key: 'biceps_left', label: 'Bíceps esquerdo', unit: 'cm', value: 31.4 },
        ],
        localDate: '2026-07-01',
        measuredAt: '2026-07-01T12:00:00.000Z',
        notes: null,
        waistCm: null,
        weightKg: null,
      }),
    ).toMatchObject({ additionalMeasurements: [{ key: 'biceps_left', value: 31.4 }] });
  });
  it('accepts daily execution, pain and habit operations while preserving explicit unknown pain', () => {
    const sessionExecution = {
      ...operation,
      baseVersion: 1,
      entityType: 'workout_session',
      operation: 'update',
      payload: {
        execution: {
          exercises: [
            {
              id: '61000000-0000-4000-8000-000000000001',
              notes: 'Execução incremental',
              sets: [
                {
                  actualRepetitions: 12,
                  completed: true,
                  id: '61000000-0000-4000-8000-000000000002',
                  setNumber: 1,
                },
                {
                  actualRepetitions: 8,
                  completed: false,
                  id: '61000000-0000-4000-8000-000000000003',
                  setNumber: 2,
                },
              ],
              status: 'stopped',
            },
          ],
          jointPainStatus: 'unknown',
        },
      },
    };
    const pain = {
      ...operation,
      entityType: 'pain_report',
      payload: {
        bodyRegion: 'ankle',
        exerciseSetId: '61000000-0000-4000-8000-000000000003',
        exerciseStopped: true,
        intensity: 'moderate',
        localDate: '2026-07-13',
        moment: 'during',
        type: 'joint',
      },
    };
    const habit = {
      ...operation,
      entityType: 'habit_entry',
      payload: {
        habitDefinitionId: '62000000-0000-4000-8000-000000000001',
        localDate: '2026-07-14',
        selectedOptionId: '62000000-0000-4000-8000-000000000002',
      },
    };

    expect(syncOperationSchema.safeParse(sessionExecution).success).toBe(true);
    expect(syncOperationSchema.safeParse(pain).success).toBe(true);
    expect(syncOperationSchema.safeParse(habit).success).toBe(true);
  });
  it('accepts planning aggregates and validates their metric-specific payload', () => {
    const templateOperation = {
      ...operation,
      entityId: '22222222-2222-4222-8222-222222222222',
      entityType: 'workout_template',
      payload: {
        exercises: [
          {
            exerciseId: '00000000-0000-4000-8000-000000000001',
            name: 'Flexão',
            sets: [{ setNumber: 1, targetRepetitions: 12 }],
            sortOrder: 0,
            trackingMetric: 'repetitions',
          },
        ],
        name: 'Treino offline',
        planId: '33333333-3333-4333-8333-333333333333',
        rules: [],
        type: 'strength',
      },
    };

    expect(syncOperationSchema.safeParse(templateOperation).success).toBe(true);
    expect(
      syncOperationSchema.safeParse({
        ...templateOperation,
        payload: {
          ...templateOperation.payload,
          exercises: [
            {
              ...templateOperation.payload.exercises[0],
              sets: [{ setNumber: 1, targetDistanceMeters: 5_000 }],
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
  it('accepts a strictly validated create operation', () => {
    expect(syncOperationSchema.parse(operation)).toEqual(operation);
  });

  it('requires the correct optimistic version for each operation kind', () => {
    expect(
      syncOperationSchema.safeParse({ ...operation, baseVersion: 1, operation: 'create' }).success,
    ).toBe(false);
    expect(
      syncOperationSchema.safeParse({ ...operation, baseVersion: null, operation: 'update' })
        .success,
    ).toBe(false);
    expect(
      syncOperationSchema.safeParse({
        ...operation,
        baseVersion: 1,
        operation: 'delete',
        payload: { notes: 'não deve ser aceito' },
      }).success,
    ).toBe(false);
  });

  it('keeps malformed items inside the batch for per-item rejection', () => {
    const parsed = syncPushRequestSchema.parse({ operations: [operation, { broken: true }] });
    expect(parsed.operations).toHaveLength(2);
  });
});
