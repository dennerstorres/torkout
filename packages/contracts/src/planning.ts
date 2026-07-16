import { z } from 'zod';

import { workoutExecutionSchema } from './daily.js';

export const SYSTEM_EXERCISES = {
  pushUp: {
    category: 'Força',
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Flexão',
    trackingMetric: 'repetitions',
  },
  squat: {
    category: 'Força',
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Agachamento livre',
    trackingMetric: 'repetitions',
  },
  walk: {
    category: 'Cardio',
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Caminhada',
    trackingMetric: 'distance',
  },
} as const;

export const trackingMetricSchema = z.enum(['repetitions', 'duration', 'distance']);
export const activityTypeSchema = z.enum(['strength', 'walk', 'rest', 'other']);
export const planStatusSchema = z.enum(['draft', 'active', 'archived']);
export const workoutStatusSchema = z.enum([
  'planned',
  'in_progress',
  'completed',
  'partial',
  'missed',
  'cancelled',
]);
export const sessionSourceSchema = z.enum(['scheduled', 'ad_hoc', 'progression']);

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário local inválido.');
const timeZoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((timeZone) => {
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone });
      return true;
    } catch {
      return false;
    }
  }, 'Fuso horário IANA inválido.');
const nullableText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();

const exerciseFields = {
  active: z.boolean().default(true),
  category: z.string().trim().min(1).max(100),
  instructions: nullableText(1_000),
  name: z.string().trim().min(1).max(120),
  trackingMetric: trackingMetricSchema,
};

export const exerciseCreateSchema = z.strictObject({
  id: z.uuid().optional(),
  ...exerciseFields,
});
export const exerciseUpdateSchema = z
  .strictObject({
    active: exerciseFields.active.optional(),
    category: exerciseFields.category.optional(),
    instructions: exerciseFields.instructions,
    name: exerciseFields.name.optional(),
    trackingMetric: exerciseFields.trackingMetric.optional(),
    version: z.number().int().positive(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: 'Informe ao menos um campo para alterar.',
  });

const planFields = {
  name: z.string().trim().min(1).max(120),
  status: planStatusSchema.default('draft'),
  validFrom: z.iso.date(),
  validUntil: z.iso.date().nullable().optional(),
};
const validPlanRange = (value: { validFrom: string; validUntil?: string | null | undefined }) =>
  !value.validUntil || value.validUntil >= value.validFrom;

export const trainingPlanCreateSchema = z
  .strictObject({ id: z.uuid().optional(), ...planFields })
  .refine(validPlanRange, { message: 'A vigência final não pode anteceder a inicial.' });
export const trainingPlanUpdateSchema = z.strictObject({
  effectiveFrom: z.iso.date().optional(),
  name: planFields.name.optional(),
  status: planStatusSchema.optional(),
  validFrom: planFields.validFrom.optional(),
  validUntil: planFields.validUntil,
  version: z.number().int().positive(),
});

export const plannedSetSchema = z
  .strictObject({
    id: z.uuid().optional(),
    setNumber: z.number().int().positive(),
    targetDistanceMeters: z.number().positive().max(1_000_000).optional(),
    targetDurationSeconds: z.number().int().positive().max(604_800).optional(),
    targetRepetitions: z.number().int().positive().max(100_000).optional(),
  })
  .refine(
    (set) =>
      [set.targetDistanceMeters, set.targetDurationSeconds, set.targetRepetitions].filter(
        (target) => target !== undefined,
      ).length === 1,
    { message: 'Cada série precisa de exatamente um alvo.' },
  );

export const plannedExerciseSchema = z
  .strictObject({
    exerciseId: z.uuid(),
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(120),
    notes: nullableText(2_000),
    sets: z.array(plannedSetSchema).max(100),
    sortOrder: z.number().int().nonnegative(),
    trackingMetric: trackingMetricSchema,
  })
  .superRefine((exercise, context) => {
    const targetForMetric = {
      distance: 'targetDistanceMeters',
      duration: 'targetDurationSeconds',
      repetitions: 'targetRepetitions',
    } as const satisfies Record<
      z.infer<typeof trackingMetricSchema>,
      'targetDistanceMeters' | 'targetDurationSeconds' | 'targetRepetitions'
    >;
    const targetField = targetForMetric[exercise.trackingMetric];
    if (exercise.sets.some((set) => set[targetField] === undefined)) {
      context.addIssue({
        code: 'custom',
        message: 'O alvo da série deve corresponder à métrica do exercício.',
        path: ['sets'],
      });
    }
    if (new Set(exercise.sets.map((set) => set.setNumber)).size !== exercise.sets.length) {
      context.addIssue({ code: 'custom', message: 'Números de série não podem repetir.' });
    }
  });

export const scheduleRuleSchema = z
  .strictObject({
    id: z.uuid(),
    localTime: timeSchema,
    timeZone: timeZoneSchema,
    validFrom: z.iso.date(),
    validUntil: z.iso.date().nullable().optional(),
    weekday: z.number().int().min(1).max(7),
  })
  .refine(validPlanRange, { message: 'A vigência final não pode anteceder a inicial.' });

const templateFields = {
  exercises: z.array(plannedExerciseSchema).max(100),
  name: z.string().trim().min(1).max(120),
  notes: nullableText(2_000),
  planId: z.uuid(),
  rules: z.array(scheduleRuleSchema).max(50),
  type: activityTypeSchema,
};

function validateTemplate(
  template: { exercises: unknown[]; type: z.infer<typeof activityTypeSchema> },
  context: z.RefinementCtx,
): void {
  if (template.type === 'rest' && template.exercises.length > 0) {
    context.addIssue({ code: 'custom', message: 'Descanso não possui exercícios.' });
  }
  if (template.type === 'strength' && template.exercises.length === 0) {
    context.addIssue({ code: 'custom', message: 'Treino de força precisa de exercício.' });
  }
}

export const workoutTemplateCreateSchema = z
  .strictObject({ id: z.uuid().optional(), ...templateFields })
  .superRefine(validateTemplate);
export const workoutTemplateUpdateSchema = z
  .strictObject({
    id: z.uuid().optional(),
    ...templateFields,
    effectiveFrom: z.iso.date(),
    version: z.number().int().positive(),
  })
  .superRefine(validateTemplate);

export const workoutSessionCreateSchema = z.strictObject({
  exercises: z.array(plannedExerciseSchema).max(100),
  id: z.uuid().optional(),
  importKey: z.string().trim().max(100).nullable().optional(),
  notes: nullableText(2_000),
  plannedLocalDate: z.iso.date(),
  scheduleRuleId: z.uuid().nullable().optional(),
  source: sessionSourceSchema.default('ad_hoc'),
  status: workoutStatusSchema.default('planned'),
  suggestedLocalTime: timeSchema.nullable().optional(),
  templateId: z.uuid().nullable().optional(),
  templateNameSnapshot: z.string().trim().min(1).max(120),
  timeZone: timeZoneSchema,
  type: activityTypeSchema,
});

export const workoutSessionUpdateSchema = z.strictObject({
  execution: workoutExecutionSchema.optional(),
  notes: nullableText(2_000),
  plannedLocalDate: z.iso.date().optional(),
  status: workoutStatusSchema.optional(),
  suggestedLocalTime: timeSchema.nullable().optional(),
  timeZone: timeZoneSchema.optional(),
  version: z.number().int().positive(),
});

export const materializeSessionsSchema = z
  .strictObject({ from: z.iso.date(), through: z.iso.date() })
  .refine((value) => value.through >= value.from, { message: 'Janela de datas inválida.' })
  .refine((value) => {
    const from = Date.parse(`${value.from}T00:00:00Z`);
    const through = Date.parse(`${value.through}T00:00:00Z`);
    return through - from <= 120 * 86_400_000;
  }, 'A janela máxima de materialização é de 120 dias.');

export type ExerciseCreate = z.infer<typeof exerciseCreateSchema>;
export type PlannedExercise = z.infer<typeof plannedExerciseSchema>;
export type TrainingPlanCreate = z.infer<typeof trainingPlanCreateSchema>;
export type WorkoutSessionCreate = z.infer<typeof workoutSessionCreateSchema>;
export type WorkoutTemplateCreate = z.infer<typeof workoutTemplateCreateSchema>;
