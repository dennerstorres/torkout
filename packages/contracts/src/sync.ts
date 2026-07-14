import { z } from 'zod';

import {
  exerciseCreateSchema,
  exerciseUpdateSchema,
  trainingPlanCreateSchema,
  trainingPlanUpdateSchema,
  workoutSessionCreateSchema,
  workoutSessionUpdateSchema,
  workoutTemplateCreateSchema,
  workoutTemplateUpdateSchema,
} from './planning.js';

export const syncEntityTypeSchema = z.enum([
  'body_measurement',
  'exercise',
  'training_plan',
  'workout_template',
  'workout_session',
]);
export const syncOperationKindSchema = z.enum(['create', 'update', 'delete']);

const bodyMeasurementFields = {
  localDate: z.iso.date(),
  measuredAt: z.iso.datetime({ offset: true }),
  notes: z.string().trim().max(2_000).nullable().optional(),
  waistCm: z.number().positive().max(500).nullable().optional(),
  weightKg: z.number().positive().max(500).nullable().optional(),
};

export const bodyMeasurementCreatePayloadSchema = z
  .strictObject(bodyMeasurementFields)
  .refine((payload) => payload.weightKg != null || payload.waistCm != null, {
    message: 'Informe peso ou cintura.',
  });

export const bodyMeasurementUpdatePayloadSchema = z
  .strictObject({
    localDate: bodyMeasurementFields.localDate.optional(),
    measuredAt: bodyMeasurementFields.measuredAt.optional(),
    notes: bodyMeasurementFields.notes,
    waistCm: bodyMeasurementFields.waistCm,
    weightKg: bodyMeasurementFields.weightKg,
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'Informe ao menos um campo para alterar.',
  });

const operationBase = {
  clientOccurredAt: z.iso.datetime({ offset: true }),
  deviceId: z.uuid(),
  entityId: z.uuid(),
  operationId: z.uuid(),
};

const versionSchema = z.number().int().positive();
const emptyPayloadSchema = z.strictObject({});
const exerciseSyncUpdateSchema = z
  .preprocess(
    (value) => ({ ...(typeof value === 'object' && value !== null ? value : {}), version: 1 }),
    exerciseUpdateSchema,
  )
  .transform(({ version, ...value }) => {
    void version;
    return value;
  });
const planSyncUpdateSchema = z
  .preprocess(
    (value) => ({ ...(typeof value === 'object' && value !== null ? value : {}), version: 1 }),
    trainingPlanUpdateSchema,
  )
  .transform(({ version, ...value }) => {
    void version;
    return value;
  });
const templateSyncUpdateSchema = z
  .preprocess(
    (value) => ({ ...(typeof value === 'object' && value !== null ? value : {}), version: 1 }),
    workoutTemplateUpdateSchema,
  )
  .transform(({ version, ...value }) => {
    void version;
    return value;
  });
const sessionSyncUpdateSchema = z
  .preprocess(
    (value) => ({ ...(typeof value === 'object' && value !== null ? value : {}), version: 1 }),
    workoutSessionUpdateSchema,
  )
  .transform(({ version, ...value }) => {
    void version;
    return value;
  });

function operationVariants<
  EntityType extends z.ZodLiteral<string>,
  CreatePayload extends z.ZodType,
  UpdatePayload extends z.ZodType,
>(entityType: EntityType, createPayload: CreatePayload, updatePayload: UpdatePayload) {
  return [
    z.strictObject({
      ...operationBase,
      baseVersion: z.null(),
      entityType,
      operation: z.literal('create'),
      payload: createPayload,
    }),
    z.strictObject({
      ...operationBase,
      baseVersion: versionSchema,
      entityType,
      operation: z.literal('update'),
      payload: updatePayload,
    }),
    z.strictObject({
      ...operationBase,
      baseVersion: versionSchema,
      entityType,
      operation: z.literal('delete'),
      payload: emptyPayloadSchema,
    }),
  ] as const;
}

export const syncOperationSchema = z.union([
  ...operationVariants(
    z.literal('body_measurement'),
    bodyMeasurementCreatePayloadSchema,
    bodyMeasurementUpdatePayloadSchema,
  ),
  ...operationVariants(z.literal('exercise'), exerciseCreateSchema, exerciseSyncUpdateSchema),
  ...operationVariants(z.literal('training_plan'), trainingPlanCreateSchema, planSyncUpdateSchema),
  ...operationVariants(
    z.literal('workout_template'),
    workoutTemplateCreateSchema,
    templateSyncUpdateSchema,
  ),
  ...operationVariants(
    z.literal('workout_session'),
    workoutSessionCreateSchema,
    sessionSyncUpdateSchema,
  ),
]);

export const syncPushRequestSchema = z.strictObject({
  operations: z.array(z.unknown()).min(1).max(50),
});

export const syncRecordSchema = z.record(z.string(), z.unknown()).and(
  z.object({
    deletedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    id: z.uuid(),
    version: z.number().int().positive(),
  }),
);

export const syncPushResultSchema = z.strictObject({
  errorCode: z.string().optional(),
  operationId: z.uuid().nullable(),
  record: syncRecordSchema.optional(),
  status: z.enum(['applied', 'duplicate', 'rejected', 'unauthorized', 'conflict']),
});

export const syncPushResponseSchema = z.strictObject({
  results: z.array(syncPushResultSchema),
});

export const syncChangeSchema = z.strictObject({
  changedAt: z.iso.datetime({ offset: true }),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
  entityId: z.uuid(),
  entityType: syncEntityTypeSchema,
  operation: syncOperationKindSchema,
  payload: syncRecordSchema,
  sequence: z.number().int().positive(),
  version: z.number().int().positive(),
});

export const syncPullResponseSchema = z.strictObject({
  changes: z.array(syncChangeSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
  serverTime: z.iso.datetime({ offset: true }),
});

export type SyncChange = z.infer<typeof syncChangeSchema>;
export type SyncEntityType = z.infer<typeof syncEntityTypeSchema>;
export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type SyncPullResponse = z.infer<typeof syncPullResponseSchema>;
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;
export type SyncPushResult = z.infer<typeof syncPushResultSchema>;
