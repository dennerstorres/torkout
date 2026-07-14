import { createDatabaseClient } from '@torkout/database';

import { buildApp } from './app.js';
import { createAuth } from './auth.js';
import type { AuthRuntime } from './auth-routes.js';
import { createSmtpEmailSender } from './email.js';
import { parseEnvironment } from './env.js';

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
  secret: environment.AUTH_SECRET,
  trustedOrigins: environment.TRUSTED_ORIGINS,
});
const app = buildApp({
  auth: auth as unknown as AuthRuntime,
  database: db,
  trustedOrigins: environment.TRUSTED_ORIGINS,
});

await app.listen({ host: environment.HOST, port: environment.PORT });

async function shutdown(): Promise<void> {
  await app.close();
  await pool.end();
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
