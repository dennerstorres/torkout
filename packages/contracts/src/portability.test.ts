import { describe, expect, it } from 'vitest';

import {
  accountDeletionResponseSchema,
  dataExportRequestSchema,
  dataExportSchema,
  pendingExportChangeSchema,
} from './portability.js';

const pendingChange = {
  baseVersion: null,
  clientOccurredAt: '2026-07-14T15:00:00.000Z',
  entityId: '70000000-0000-4000-8000-000000000001',
  entityType: 'body_measurement' as const,
  operation: 'create' as const,
  origin: 'local_pending' as const,
  payload: {
    localDate: '2026-07-14',
    measuredAt: '2026-07-14T15:00:00.000Z',
    weightKg: 70,
  },
};

describe('data portability contracts', () => {
  it('versions a structurally round-trippable JSON export', () => {
    const exported = dataExportSchema.parse({
      account: {
        createdAt: '2026-07-14T10:00:00.000Z',
        email: 'person@example.invalid',
        emailVerified: true,
        id: '60000000-0000-4000-8000-000000000001',
        name: 'Pessoa com acento',
        updatedAt: '2026-07-14T10:00:00.000Z',
      },
      entities: {
        bodyMeasurements: [{ id: pendingChange.entityId, weightKg: '70.00' }],
        exercises: [],
        exerciseSets: [],
        habitDefinitions: [],
        habitEntries: [],
        habitOptions: [],
        painReports: [],
        privacyAcceptances: [],
        progressionDecisions: [],
        progressionEvaluations: [],
        progressionRuleVersions: [],
        progressionSuggestions: [],
        scheduleRules: [],
        sessionExercises: [],
        trainingPlans: [],
        userProfiles: [],
        walkingDetails: [],
        workoutSessions: [],
        workoutTemplateExercises: [],
        workoutTemplates: [],
        workoutTemplateSets: [],
      },
      exportedAt: '2026-07-14T16:00:00.000Z',
      formatVersion: '1.0.0',
      pendingChanges: [pendingChange],
      timeZone: 'America/Cuiaba',
      units: { distance: 'meter', height: 'centimeter', waist: 'centimeter', weight: 'kilogram' },
    });

    expect(dataExportSchema.parse(JSON.parse(JSON.stringify(exported)))).toEqual(exported);
    expect(exported.pendingChanges[0]).toEqual(pendingChange);
  });

  it('accepts only sanitized local pending changes and supported formats', () => {
    expect(pendingExportChangeSchema.parse(pendingChange)).toEqual(pendingChange);
    expect(
      pendingExportChangeSchema.safeParse({
        ...pendingChange,
        deviceId: '80000000-0000-4000-8000-000000000001',
        operationId: '90000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(false);
    expect(
      pendingExportChangeSchema.safeParse({
        ...pendingChange,
        payload: { ...pendingChange.payload, sessionToken: 'must-not-be-exported' },
      }).success,
    ).toBe(false);
    expect(
      dataExportRequestSchema.parse({ format: 'csv_zip', pendingChanges: [pendingChange] }),
    ).toMatchObject({ format: 'csv_zip' });
  });

  it('documents immediate active-data erasure and finite backup retention', () => {
    expect(
      accountDeletionResponseSchema.parse({
        activeDataDeleted: true,
        backupRetention: {
          appliesTo: 'Cópias de segurança isoladas, sem uso no produto ativo.',
          maximumDays: 365,
          policy: '7 diárias, 5 semanais e 12 mensais.',
        },
      }),
    ).toMatchObject({ activeDataDeleted: true, backupRetention: { maximumDays: 365 } });
  });
});
