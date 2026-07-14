import { z } from 'zod';

export * from './auth.js';
export * from './daily.js';
export * from './planning.js';
export * from './sync.js';

export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
