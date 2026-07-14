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

export type ProgressAnalyticsResponse = z.infer<typeof progressAnalyticsResponseSchema>;
export type ProgressQuery = z.infer<typeof progressQuerySchema>;
