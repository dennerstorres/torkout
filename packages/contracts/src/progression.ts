import { z } from 'zod';

export const progressionSuggestionStatusSchema = z.enum([
  'pending',
  'accepted',
  'ignored',
  'snoozed',
  'invalidated',
  'expired',
]);
export const progressionDecisionSchema = z.enum(['accepted', 'ignored', 'snoozed']);
export const progressionProposalSchema = z.strictObject({
  effectiveAfter: z.iso.date(),
  exerciseId: z.uuid(),
  fromRepetitions: z.array(z.number().int().nonnegative()).optional(),
  mode: z.enum(['increase_repetitions', 'maintain', 'reduce_repetitions', 'remove_set', 'stop']),
  sourceTemplateExerciseId: z.uuid().nullable().optional(),
  toRepetitions: z.array(z.number().int().nonnegative()).optional(),
});
export const progressionDecisionCreateSchema = z.strictObject({
  decision: progressionDecisionSchema,
  id: z.uuid().optional(),
});
export const progressionSuggestionQuerySchema = z.strictObject({
  status: progressionSuggestionStatusSchema.optional(),
});
export type ProgressionDecisionCreate = z.infer<typeof progressionDecisionCreateSchema>;
