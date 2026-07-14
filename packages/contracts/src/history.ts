import { z } from 'zod';

import { activityTypeSchema, workoutStatusSchema } from './planning.js';

const historyRangeFields = {
  cursor: z.string().min(1).max(200).optional(),
  from: z.iso.date(),
  limit: z.coerce.number().int().min(1).max(31).default(14),
  through: z.iso.date(),
};

export const historyQuerySchema = z
  .strictObject(historyRangeFields)
  .refine((query) => query.through >= query.from, 'A data final nÃ£o pode anteceder a inicial.')
  .refine(
    (query) =>
      Date.parse(`${query.through}T00:00:00Z`) - Date.parse(`${query.from}T00:00:00Z`) <=
      366 * 86_400_000,
    'O intervalo histÃ³rico mÃ¡ximo Ã© de 366 dias.',
  );

const versionedRecordSchema = z.looseObject({
  id: z.uuid(),
  version: z.number().int().positive(),
});
const historySessionSchema = versionedRecordSchema.extend({
  status: workoutStatusSchema,
  type: activityTypeSchema,
});

export const historyDaySchema = z.strictObject({
  habitEntries: z.array(versionedRecordSchema),
  localDate: z.iso.date(),
  measurements: z.array(versionedRecordSchema),
  painReports: z.array(versionedRecordSchema),
  sessions: z.array(historySessionSchema),
});

export const historyPageSchema = z.strictObject({
  days: z.array(historyDaySchema).max(31),
  habits: z.array(versionedRecordSchema),
  nextCursor: z.string().nullable(),
});

export type HistoryPage = z.infer<typeof historyPageSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
