import { z } from 'zod';

const environmentSchema = z
  .strictObject({
    AUTH_BASE_URL: z
      .url()
      .refine((value) => value.startsWith('https://') || value.startsWith('http://localhost')),
    AUTH_SECRET: z.string().min(32),
    DATABASE_URL: z.string().url().startsWith('postgresql://'),
    HOST: z.string().min(1).default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Diretório do driver local de armazenamento de objetos; use um volume persistente. */
    OBJECT_STORAGE_DIR: z.string().min(1).default('./var/object-storage'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    SMTP_FROM: z.string().min(3),
    SMTP_HOST: z.string().min(1),
    SMTP_PASSWORD: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535),
    SMTP_SECURE: z.enum(['true', 'false']).transform((value) => value === 'true'),
    SMTP_USER: z.string().min(1),
    TRUST_PROXY: z
      .string()
      .default('127.0.0.1,::1')
      .transform((value) => value.split(',').map((entry) => entry.trim()))
      .pipe(z.array(z.string().min(1)).min(1)),
    TRUSTED_ORIGINS: z
      .string()
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(z.array(z.url()).min(1)),
  })
  .refine(
    (environment) =>
      environment.TRUSTED_ORIGINS.includes(new URL(environment.AUTH_BASE_URL).origin),
    { message: 'AUTH_BASE_URL must be included in TRUSTED_ORIGINS', path: ['TRUSTED_ORIGINS'] },
  );

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(
  input: Record<string, string | undefined> = process.env,
): Environment {
  return environmentSchema.parse({
    AUTH_BASE_URL: input.AUTH_BASE_URL,
    AUTH_SECRET: input.AUTH_SECRET,
    DATABASE_URL: input.DATABASE_URL,
    HOST: input.HOST,
    LOG_LEVEL: input.LOG_LEVEL,
    NODE_ENV: input.NODE_ENV,
    OBJECT_STORAGE_DIR: input.OBJECT_STORAGE_DIR,
    PORT: input.PORT,
    SMTP_FROM: input.SMTP_FROM,
    SMTP_HOST: input.SMTP_HOST,
    SMTP_PASSWORD: input.SMTP_PASSWORD,
    SMTP_PORT: input.SMTP_PORT,
    SMTP_SECURE: input.SMTP_SECURE,
    SMTP_USER: input.SMTP_USER,
    TRUST_PROXY: input.TRUST_PROXY,
    TRUSTED_ORIGINS: input.TRUSTED_ORIGINS,
  });
}
