import { z } from 'zod';

export const syncEntityTypeSchema = z.enum(['body_measurement']);
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
  entityType: syncEntityTypeSchema,
  operationId: z.uuid(),
};

export const syncOperationSchema = z.discriminatedUnion('operation', [
  z.strictObject({
    ...operationBase,
    baseVersion: z.null(),
    operation: z.literal('create'),
    payload: bodyMeasurementCreatePayloadSchema,
  }),
  z.strictObject({
    ...operationBase,
    baseVersion: z.number().int().positive(),
    operation: z.literal('update'),
    payload: bodyMeasurementUpdatePayloadSchema,
  }),
  z.strictObject({
    ...operationBase,
    baseVersion: z.number().int().positive(),
    operation: z.literal('delete'),
    payload: z.strictObject({}),
  }),
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
