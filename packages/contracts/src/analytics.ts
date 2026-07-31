import { z } from 'zod';

import { bodyRegionSchema, painIntensitySchema, painTypeSchema } from './daily.js';
import { trackingMetricSchema } from './planning.js';

const DAY_MS = 86_400_000;

export const progressQuerySchema = z
  .strictObject({ from: z.iso.date(), through: z.iso.date() })
  .refine((query) => query.through >= query.from, 'A data final nÃ£o pode anteceder a inicial.')
  .refine(
    (query) =>
      Date.parse(`${query.through}T00:00:00Z`) - Date.parse(`${query.from}T00:00:00Z`) <=
      365 * DAY_MS,
    'O intervalo de progresso mÃ¡ximo Ã© de 366 dias inclusivos.',
  );

const measurementPointSchema = z.strictObject({
  localDate: z.iso.date(),
  measuredAt: z.iso.datetime({ offset: true }),
  waistCm: z.number().nonnegative().nullable(),
  weightKg: z.number().nonnegative().nullable(),
});
const exercisePointSchema = z.strictObject({
  localDate: z.iso.date(),
  value: z.number().nonnegative(),
});

export const progressAnalyticsResponseSchema = z.strictObject({
  consistency: z.strictObject({
    explanation: z.string().min(1),
    formulaVersion: z.literal('weekly-consistency/v1'),
    weeks: z.array(
      z.strictObject({
        completedEquivalent: z.number().nonnegative(),
        percentage: z.number().min(0).max(100).nullable(),
        plannedExecutable: z.number().int().nonnegative(),
        weekEnd: z.iso.date(),
        weekStart: z.iso.date(),
      }),
    ),
  }),
  exercises: z.array(
    z.strictObject({
      exerciseId: z.uuid().nullable(),
      metric: trackingMetricSchema,
      name: z.string().min(1),
      points: z.array(exercisePointSchema),
      total: z.number().nonnegative(),
    }),
  ),
  measurements: z.array(measurementPointSchema),
  pain: z.array(
    z.strictObject({
      bodyRegion: bodyRegionSchema,
      count: z.number().int().positive(),
      intensity: painIntensitySchema,
      type: painTypeSchema,
    }),
  ),
  range: z.strictObject({ from: z.iso.date(), through: z.iso.date() }),
  sessions: z.strictObject({
    completed: z.number().int().nonnegative(),
    partial: z.number().int().nonnegative(),
  }),
  walks: z.strictObject({
    distanceMeters: z.number().nonnegative(),
    frequencyPerWeek: z.number().nonnegative(),
    sessions: z.number().int().nonnegative(),
  }),
});

const adherenceBreakdownSchema = z.strictObject({
  cancelled: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  due: z.number().int().nonnegative(),
  future: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100).nullable(),
  score: z.number().nonnegative(),
});

export const adherenceResultSchema = z.strictObject({
  evaluatedFrom: z.iso.date(),
  evaluatedThrough: z.iso.date(),
  explanation: z.string().min(1),
  formulaVersion: z.literal('adherence/v1'),
  general: adherenceBreakdownSchema,
  strength: adherenceBreakdownSchema,
  walk: adherenceBreakdownSchema,
});

const measurementTrendSchema = z
  .strictObject({
    delta: z.number(),
    first: z.strictObject({ localDate: z.iso.date(), value: z.number() }),
    last: z.strictObject({ localDate: z.iso.date(), value: z.number() }),
  })
  .nullable();

const repetitionPointSchema = z.strictObject({
  localDate: z.iso.date(),
  repetitions: z.number().nonnegative(),
});

const levelCriterionSchema = z.strictObject({
  achieved: z.boolean(),
  key: z.enum(['concludedSessions', 'evolutionRecords', 'longestStreak', 'regularWeeks']),
  label: z.string().min(1),
  target: z.number().int().nonnegative(),
  value: z.number().int().nonnegative(),
});

const levelStatusSchema = z.strictObject({
  achieved: z.boolean(),
  achievedAt: z.iso.date().nullable(),
  criteria: z.array(levelCriterionSchema),
  id: z.string().min(1),
  index: z.number().int().nonnegative(),
  name: z.string().min(1),
});

export const progressPanelResponseSchema = z.strictObject({
  abdomen: measurementTrendSchema,
  adherence: adherenceResultSchema,
  averagePerceivedExertion: z.number().min(0).max(10).nullable(),
  bestSet: z
    .strictObject({
      exercise: z.string().min(1),
      localDate: z.iso.date(),
      repetitions: z.number().positive(),
    })
    .nullable(),
  concludedSessions: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative(),
  jointPainReports: z.number().int().nonnegative(),
  levels: z.strictObject({
    current: levelStatusSchema,
    levels: z.array(levelStatusSchema),
    metrics: z.strictObject({
      concludedSessions: z.number().int().nonnegative(),
      currentStreak: z.number().int().nonnegative(),
      evolutionRecords: z.number().int().nonnegative(),
      longestStreak: z.number().int().nonnegative(),
      regularWeeks: z.number().int().nonnegative(),
    }),
    next: levelStatusSchema.nullable(),
    progressToNext: z.number().min(0).max(100),
  }),
  longestStreak: z.number().int().nonnegative(),
  muscularPainReports: z.number().int().nonnegative(),
  otherDiscomfortReports: z.number().int().nonnegative(),
  perceivedExertionSamples: z.number().int().nonnegative(),
  pushUpsPerSession: z.array(repetitionPointSchema),
  range: z.strictObject({ from: z.iso.date(), through: z.iso.date() }),
  sessionsThisWeek: z.number().int().nonnegative(),
  sessionsWithoutPain: z.number().int().nonnegative(),
  squatsPerSession: z.array(repetitionPointSchema),
  strengthSessionsThisWeek: z.number().int().nonnegative(),
  waist: measurementTrendSchema,
  walkDistanceMeters: z.number().nonnegative(),
  walkDurationSeconds: z.number().nonnegative(),
  walksConcluded: z.number().int().nonnegative(),
  weight: measurementTrendSchema,
});

export type AdherenceResultResponse = z.infer<typeof adherenceResultSchema>;
export type ProgressAnalyticsResponse = z.infer<typeof progressAnalyticsResponseSchema>;
export type ProgressPanelResponse = z.infer<typeof progressPanelResponseSchema>;
export type ProgressQuery = z.infer<typeof progressQuerySchema>;
