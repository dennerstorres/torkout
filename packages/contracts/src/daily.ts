import { z } from 'zod';

export const jointPainStatusSchema = z.enum(['unknown', 'none', 'reported']);
export const sessionExerciseStatusSchema = z.enum(['planned', 'completed', 'skipped', 'stopped']);
export const painTypeSchema = z.enum(['muscular', 'joint']);
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

export const workoutExecutionSchema = z.strictObject({
  completedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  exercises: z.array(executionExerciseSchema).max(100),
  jointPainStatus: jointPainStatusSchema.default('unknown'),
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
  localDate: z.iso.date(),
  moment: painMomentSchema,
  notes: nullableNotes,
  occurredAt: z.iso.datetime({ offset: true }).nullable().optional(),
  sessionId: z.uuid().nullable().optional(),
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

export const dailyImportSchema = z.strictObject({
  localDate: z.literal('2026-07-13'),
});

export type HabitDefinitionCreate = z.infer<typeof habitDefinitionCreateSchema>;
export type PainReportCreate = z.infer<typeof painReportCreateSchema>;
export type WorkoutExecution = z.infer<typeof workoutExecutionSchema>;
