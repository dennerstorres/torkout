import { createDatabaseClient } from '@torkout/database';

import { buildApp } from './app.js';
import { createAuth } from './auth.js';
import type { AuthRuntime } from './auth-routes.js';
import { createSmtpEmailSender } from './email.js';
import { parseEnvironment } from './env.js';
import { createLoggerOptions } from './operational.js';
import { createLocalObjectStorage } from './storage.js';

const environment = parseEnvironment();
const { db, pool } = createDatabaseClient(environment.DATABASE_URL);
const emailSender = createSmtpEmailSender({
  from: environment.SMTP_FROM,
  host: environment.SMTP_HOST,
  password: environment.SMTP_PASSWORD,
  port: environment.SMTP_PORT,
  secure: environment.SMTP_SECURE,
  user: environment.SMTP_USER,
});
const auth = createAuth({
  baseURL: environment.AUTH_BASE_URL,
  database: db,
  emailSender,
  publicSignUpEnabled: environment.PUBLIC_SIGNUP_ENABLED,
  secret: environment.AUTH_SECRET,
  trustedOrigins: environment.TRUSTED_ORIGINS,
});
const app = buildApp(
  {
    auth: auth as unknown as AuthRuntime,
    database: db,
    storage: createLocalObjectStorage(environment.OBJECT_STORAGE_DIR),
    trustedOrigins: environment.TRUSTED_ORIGINS,
  },
  {
    logger: createLoggerOptions(environment.LOG_LEVEL),
    mcp: environment.MCP_ENABLED
      ? { publicUrl: environment.MCP_PUBLIC_URL ?? environment.AUTH_BASE_URL }
      : undefined,
    production: environment.NODE_ENV === 'production',
    readiness: async () => {
      await pool.query('select 1');
    },
    trustProxy: environment.TRUST_PROXY,
  },
);

await app.listen({ host: environment.HOST, port: environment.PORT });

async function shutdown(): Promise<void> {
  await app.close();
  await pool.end();
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
