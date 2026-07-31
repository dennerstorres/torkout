import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import {
  accounts,
  consumedAuthTokens,
  type DatabaseClient,
  sessions,
  users,
  verifications,
} from '@torkout/database';
import { betterAuth } from 'better-auth';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';

import type { EmailSender } from './email.js';
import { hashPassword, verifyPassword } from './password.js';

export interface CreateAuthOptions {
  baseURL: string;
  database: DatabaseClient;
  emailSender: EmailSender;
  /**
   * Cadastro público. O padrão é fechado; a instância precisa habilitá-lo explicitamente. Com o
   * cadastro fechado, entrada, verificação de e-mail e recuperação de senha continuam disponíveis
   * para contas já existentes.
   */
  publicSignUpEnabled?: boolean;
  secret: string;
  trustedOrigins: string[];
}

export function createAuth(options: CreateAuthOptions) {
  const auth = betterAuth({
    advanced: {
      database: { generateId: 'uuid' },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      useSecureCookies: true,
    },
    appName: 'Torkout',
    basePath: '/auth',
    baseURL: options.baseURL,
    database: drizzleAdapter(options.database, {
      provider: 'pg',
      schema: {
        account: accounts,
        session: sessions,
        user: users,
        verification: verifications,
      },
    }),
    emailAndPassword: {
      autoSignIn: false,
      disableSignUp: options.publicSignUpEnabled !== true,
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12,
      password: { hash: hashPassword, verify: verifyPassword },
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 15 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await options.emailSender.send({ kind: 'password-reset', to: user.email, url });
      },
    },
    emailVerification: {
      autoSignInAfterVerification: false,
      expiresIn: 30 * 60,
      sendOnSignIn: true,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await options.emailSender.send({ kind: 'verification', to: user.email, url });
      },
    },
    rateLimit: {
      customRules: {
        '/forget-password': { max: 3, window: 60 },
        '/request-password-reset': { max: 3, window: 60 },
        '/send-verification-email': { max: 3, window: 60 },
        '/sign-in/email': { max: 3, window: 60 },
        '/sign-up/email': { max: 3, window: 60 },
        '/verify-email': { max: 5, window: 60 },
      },
      enabled: true,
      max: 30,
      storage: 'memory',
      window: 60,
    },
    secret: options.secret,
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      freshAge: 10 * 60,
      updateAge: 60 * 60 * 24,
    },
    trustedOrigins: options.trustedOrigins,
    user: {
      deleteUser: { enabled: true },
    },
    verification: {
      storeIdentifier: 'hashed',
    },
  });

  const handler = auth.handler;
  return {
    ...auth,
    handler: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      if (request.method === 'GET' && url.pathname === '/auth/verify-email') {
        const token = url.searchParams.get('token');
        if (token) {
          const tokenHash = createHash('sha256').update(token).digest('hex');
          const consumed = await options.database
            .insert(consumedAuthTokens)
            .values({
              expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
              purpose: 'email-verification',
              tokenHash,
            })
            .onConflictDoNothing({ target: consumedAuthTokens.tokenHash })
            .returning({ id: consumedAuthTokens.id });
          if (consumed.length === 0) {
            return Response.json(
              { code: 'TOKEN_ALREADY_USED', message: 'Este link já foi utilizado.' },
              { status: 401 },
            );
          }
        }
      }
      const response = await handler(request);
      if (request.method === 'POST' && url.pathname === '/auth/sign-in/email' && response.ok) {
        const payload = (await response.clone().json()) as { user?: { id?: string } };
        if (payload.user?.id) {
          const [user] = await options.database
            .select({ banExpires: users.banExpires, banned: users.banned })
            .from(users)
            .where(eq(users.id, payload.user.id))
            .limit(1);
          const activelyBanned =
            user?.banned && (!user.banExpires || user.banExpires.getTime() > Date.now());
          if (activelyBanned) {
            await options.database.delete(sessions).where(eq(sessions.userId, payload.user.id));
            return Response.json(
              { code: 'ACCOUNT_BLOCKED', message: 'Não foi possível entrar nesta conta.' },
              { status: 403 },
            );
          }
        }
      }
      return response;
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;
