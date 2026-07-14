import { z } from 'zod';

const environmentSchema = z.strictObject({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(
  input: Record<string, string | undefined> = process.env,
): Environment {
  return environmentSchema.parse({
    DATABASE_URL: input.DATABASE_URL,
    HOST: input.HOST,
    LOG_LEVEL: input.LOG_LEVEL,
    NODE_ENV: input.NODE_ENV,
    PORT: input.PORT,
  });
}
