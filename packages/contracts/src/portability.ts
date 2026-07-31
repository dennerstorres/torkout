import { z } from 'zod';

import { syncEntityTypeSchema, syncOperationKindSchema } from './sync.js';

export const DATA_EXPORT_FORMAT_VERSION = '1.0.0' as const;

const jsonRecordSchema = z.record(z.string(), z.json());

function hasSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, nested]) =>
      /password|token|secret|session(?:cookie|secret|token)|device(?:id|key)|operationid|hash/i.test(
        key,
      ) || hasSensitiveKey(nested),
  );
}

export const pendingExportChangeSchema = z
  .strictObject({
    baseVersion: z.number().int().positive().nullable(),
    clientOccurredAt: z.iso.datetime({ offset: true }),
    entityId: z.uuid(),
    entityType: syncEntityTypeSchema,
    operation: syncOperationKindSchema,
    origin: z.literal('local_pending'),
    payload: jsonRecordSchema,
  })
  .refine((change) => !hasSensitiveKey(change.payload), {
    message: 'A alteração pendente contém metadados internos ou credenciais.',
    path: ['payload'],
  });

export const dataExportRequestSchema = z
  .strictObject({
    format: z.enum(['json', 'csv_zip', 'markdown']),
    /** Período solicitado pelo usuário; o relatório informa também o período efetivamente avaliado. */
    from: z.iso.date().optional(),
    pendingChanges: z.array(pendingExportChangeSchema).max(5_000).default([]),
    through: z.iso.date().optional(),
  })
  .refine(
    (request) => !request.from || !request.through || request.through >= request.from,
    'A data final não pode anteceder a inicial.',
  );

export const dataExportEntityNames = [
  'bodyMeasurements',
  'coffeeIntakes',
  'exercises',
  'exerciseSets',
  'habitDefinitions',
  'habitEntries',
  'habitOptions',
  'painReports',
  'privacyAcceptances',
  'progressPhotos',
  'progressionDecisions',
  'progressionEvaluations',
  'progressionRuleVersions',
  'progressionSuggestions',
  'scheduleRules',
  'sessionExercises',
  'trainingPlans',
  'userProfiles',
  'walkingDetails',
  'wheyIntakes',
  'workoutSessions',
  'workoutTemplateExercises',
  'workoutTemplates',
  'workoutTemplateSets',
] as const;

const entityCollections = Object.fromEntries(
  dataExportEntityNames.map((name) => [name, z.array(jsonRecordSchema)]),
) as { [Name in (typeof dataExportEntityNames)[number]]: z.ZodArray<typeof jsonRecordSchema> };

export const dataExportSchema = z.strictObject({
  account: z.strictObject({
    createdAt: z.iso.datetime({ offset: true }),
    email: z.email(),
    emailVerified: z.boolean(),
    id: z.uuid(),
    name: z.string(),
    updatedAt: z.iso.datetime({ offset: true }),
  }),
  entities: z.strictObject(entityCollections),
  exportedAt: z.iso.datetime({ offset: true }),
  formatVersion: z.literal(DATA_EXPORT_FORMAT_VERSION),
  pendingChanges: z.array(pendingExportChangeSchema),
  requestedRange: z
    .strictObject({ from: z.iso.date(), through: z.iso.date() })
    .nullable()
    .optional(),
  timeZone: z.string().min(1),
  units: z.strictObject({
    distance: z.literal('meter'),
    height: z.literal('centimeter'),
    waist: z.literal('centimeter'),
    weight: z.literal('kilogram'),
  }),
});

export const accountDeletionResponseSchema = z.strictObject({
  activeDataDeleted: z.literal(true),
  backupRetention: z.strictObject({
    appliesTo: z.string().min(1),
    maximumDays: z.number().int().positive(),
    policy: z.string().min(1),
  }),
});

export type AccountDeletionResponse = z.infer<typeof accountDeletionResponseSchema>;
export type DataExport = z.infer<typeof dataExportSchema>;
export type DataExportRequest = z.infer<typeof dataExportRequestSchema>;
export type PendingExportChange = z.infer<typeof pendingExportChangeSchema>;
