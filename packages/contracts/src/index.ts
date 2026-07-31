import { z } from 'zod';

export * from './analytics.js';
export * from './auth.js';
export * from './daily.js';
export * from './history.js';
export * from './nutrition.js';
export * from './photos.js';
export * from './planning.js';
export * from './portability.js';
export * from './progression.js';
export * from './sync.js';

export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
