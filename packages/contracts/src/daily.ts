import { z } from 'zod';

export const jointPainStatusSchema = z.enum(['unknown', 'none', 'reported']);
export const sessionExerciseStatusSchema = z.enum(['planned', 'completed', 'skipped', 'stopped']);
/**
 * `other` cobre desconfortos que não são musculares nem articulares. Registros antigos continuam
 * válidos porque os dois valores originais foram preservados na mesma posição.
 */
export const painTypeSchema = z.enum(['muscular', 'joint', 'other']);
/** Resposta explícita da etapa de recuperação; `not_answered` significa ausência de resposta. */
export const recoveryStatusSchema = z.enum(['not_answered', 'none', 'reported']);
export const painIntensitySchema = z.enum(['not_informed', 'light', 'moderate', 'strong']);
export const painMomentSchema = z.enum(['before', 'during', 'after', 'next_day']);
export const bodyRegionSchema = z.enum([
  'neck',
  'shoulder',
  'arm',
  'elbow',
  'wrist',
  'hand',
  'chest',
  'back',
  'abdomen',
  'hip',
  'thigh',
  'knee',
  'leg',
  'ankle',
  'foot',
  'other',
]);
export const habitTypeSchema = z.enum(['boolean', 'quantity', 'scale', 'choice']);

const nullableNotes = z.string().trim().max(2_000).nullable().optional();
const nullablePositiveNumber = (maximum: number) =>
  z.number().nonnegative().max(maximum).nullable().optional();

export const executionSetSchema = z
  .strictObject({
    actualDistanceMeters: nullablePositiveNumber(1_000_000),
    actualDurationSeconds: z.number().int().nonnegative().max(604_800).nullable().optional(),
    actualRepetitions: z.number().int().nonnegative().max(100_000).nullable().optional(),
    completed: z.boolean(),
    id: z.uuid(),
    setNumber: z.number().int().positive(),
  })
  .refine(
    (set) =>
      [set.actualDistanceMeters, set.actualDurationSeconds, set.actualRepetitions].filter(
        (value) => value != null,
      ).length <= 1,
    'Uma série pode registrar somente a métrica aplicável.',
  );

export const executionExerciseSchema = z.strictObject({
  id: z.uuid(),
  notes: nullableNotes,
  sets: z.array(executionSetSchema).max(100),
  status: sessionExerciseStatusSchema,
});

export const walkingExecutionSchema = z.strictObject({
  actualDistanceMeters: nullablePositiveNumber(1_000_000),
  distanceSource: z.enum(['manual', 'gps', 'import']).default('manual'),
  durationSeconds: z.number().int().nonnegative().max(604_800).nullable().optional(),
  notes: nullableNotes,
});

/** Escala de esforço percebido de 0 a 10; sempre opcional para manter o fechamento rápido. */
export const perceivedExertionSchema = z.number().int().min(0).max(10);

export const workoutExecutionSchema = z.strictObject({
  completedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  exercises: z.array(executionExerciseSchema).max(100),
  jointPainStatus: jointPainStatusSchema.default('unknown'),
  perceivedExertion: perceivedExertionSchema.nullable().optional(),
  recoveryStatus: recoveryStatusSchema.default('not_answered'),
  startedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  walking: walkingExecutionSchema.nullable().optional(),
});

const painFields = {
  bodyRegion: bodyRegionSchema,
  customBodyRegion: z.string().trim().min(1).max(120).nullable().optional(),
  exerciseId: z.uuid().nullable().optional(),
  exerciseSetId: z.uuid().nullable().optional(),
  exerciseStopped: z.boolean().default(false),
  intensity: painIntensitySchema.default('not_informed'),
  /** Escala numérica de 0 a 10; convive com a escala qualitativa herdada. */
  intensityScore: z.number().int().min(0).max(10).nullable().optional(),
  localDate: z.iso.date(),
  moment: painMomentSchema,
  notes: nullableNotes,
  occurredAt: z.iso.datetime({ offset: true }).nullable().optional(),
  sessionId: z.uuid().nullable().optional(),
  supportDifficulty: z.boolean().nullable().optional(),
  swelling: z.boolean().nullable().optional(),
  type: painTypeSchema,
};

function validateCustomRegion(
  value: {
    bodyRegion: z.infer<typeof bodyRegionSchema>;
    customBodyRegion?: string | null | undefined;
  },
  context: z.RefinementCtx,
): void {
  if (value.bodyRegion === 'other' && !value.customBodyRegion) {
    context.addIssue({ code: 'custom', message: 'Informe a região corporal.' });
  }
  if (value.bodyRegion !== 'other' && value.customBodyRegion != null) {
    context.addIssue({ code: 'custom', message: 'Região personalizada só é válida para outra.' });
  }
}

export const painReportCreateSchema = z
  .strictObject({ id: z.uuid().optional(), ...painFields })
  .superRefine(validateCustomRegion);
export const painReportUpdateSchema = z.strictObject(painFields).partial();

/**
 * Etapa opcional de recuperação exibida ao concluir um treino. A resposta "não" é armazenada de
 * forma explícita e nunca exige detalhes.
 */
export const sessionRecoverySchema = z
  .strictObject({
    reports: z
      .array(z.strictObject(painFields).superRefine(validateCustomRegion))
      .max(20)
      .default([]),
    status: recoveryStatusSchema,
  })
  .superRefine((value, context) => {
    if (value.status === 'reported' && value.reports.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Informe ao menos um desconforto.',
        path: ['reports'],
      });
    }
    if (value.status !== 'reported' && value.reports.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Não registre desconfortos quando a resposta foi "não".',
        path: ['reports'],
      });
    }
  });

export const habitOptionSchema = z.strictObject({
  id: z.uuid().optional(),
  label: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().nonnegative(),
  stableValue: z.string().trim().min(1).max(80),
});
export const habitDefinitionCreateSchema = z.strictObject({
  active: z.boolean().default(true),
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  options: z.array(habitOptionSchema).max(30).default([]),
  sortOrder: z.number().int().nonnegative().default(0),
  type: habitTypeSchema,
  unit: z.string().trim().max(40).nullable().optional(),
});
export const habitDefinitionUpdateSchema = habitDefinitionCreateSchema
  .omit({ id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para alterar.');

const habitValueFields = {
  booleanValue: z.boolean().nullable().optional(),
  notes: nullableNotes,
  numericValue: z.number().nonnegative().max(1_000_000).nullable().optional(),
  selectedOptionId: z.uuid().nullable().optional(),
  textValue: z.string().trim().max(500).nullable().optional(),
};
const habitEntryFields = {
  ...habitValueFields,
  habitDefinitionId: z.uuid(),
  localDate: z.iso.date(),
};
function habitValueCount(value: {
  booleanValue?: boolean | null | undefined;
  numericValue?: number | null | undefined;
  selectedOptionId?: string | null | undefined;
  textValue?: string | null | undefined;
}): number {
  return [value.booleanValue, value.numericValue, value.selectedOptionId, value.textValue].filter(
    (item) => item != null,
  ).length;
}
function validateHabitEntry(
  value: z.infer<z.ZodObject<typeof habitEntryFields>>,
  context: z.RefinementCtx,
): void {
  if (habitValueCount(value) !== 1)
    context.addIssue({ code: 'custom', message: 'Informe exatamente um valor.' });
}
export const habitEntryCreateSchema = z
  .strictObject({ id: z.uuid().optional(), ...habitEntryFields })
  .superRefine(validateHabitEntry);
export const habitEntryValueSchema = z
  .strictObject(habitValueFields)
  .superRefine((value, context) => {
    if (habitValueCount(value) !== 1) {
      context.addIssue({ code: 'custom', message: 'Informe exatamente um valor.' });
    }
  });
export const habitEntryUpdateSchema = z
  .strictObject(habitEntryFields)
  .partial()
  .superRefine((value, context) => {
    const valueKeys = ['booleanValue', 'numericValue', 'selectedOptionId', 'textValue'] as const;
    if (valueKeys.some((key) => key in value) && habitValueCount(value) !== 1) {
      context.addIssue({ code: 'custom', message: 'Informe exatamente um valor.' });
    }
  });

export type HabitDefinitionCreate = z.infer<typeof habitDefinitionCreateSchema>;
export type PainReportCreate = z.infer<typeof painReportCreateSchema>;
export type PainType = z.infer<typeof painTypeSchema>;
export type RecoveryStatus = z.infer<typeof recoveryStatusSchema>;
export type SessionRecovery = z.infer<typeof sessionRecoverySchema>;
export type WorkoutExecution = z.infer<typeof workoutExecutionSchema>;
