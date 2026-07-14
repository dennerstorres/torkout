import { privacyAcceptances, privacyDocuments } from '@torkout/database';
import { privacyAcceptanceSchema } from '@torkout/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';

export const PUBLIC_PRIVACY_DOCUMENTS = [
  {
    content:
      'O Torkout usa dados de conta e treino somente para prestar o serviço, com acesso limitado ao titular e retenção conforme a finalidade.',
    title: 'Aviso de privacidade',
    type: 'privacy_notice',
    version: '2026-07-14',
  },
  {
    content:
      'O Torkout é uma ferramenta pessoal de registro. O usuário é responsável por sua conta e pode exportar ou excluir seus dados.',
    title: 'Termos de uso',
    type: 'terms',
    version: '2026-07-14',
  },
  {
    content:
      'Você autoriza o tratamento de registros de treino, medidas, hábitos e dor para as funções solicitadas. Sugestões não são orientação médica.',
    title: 'Consentimento para dados de saúde',
    type: 'health_data_consent',
    version: '2026-07-14',
  },
] as const;

function userAgentFamily(value: string | undefined): string | null {
  return value?.split(/[\s/]/, 1)[0]?.slice(0, 50) || null;
}

export function registerPrivacyRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.get('/api/v1/privacy/documents', async () => ({ documents: PUBLIC_PRIVACY_DOCUMENTS }));

  app.post('/api/v1/privacy/acceptances', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const parsed = privacyAcceptanceSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Aceites de privacidade inválidos.');
    }

    await dependencies.database.transaction(async (transaction) => {
      for (const document of PUBLIC_PRIVACY_DOCUMENTS) {
        const requestedVersion = parsed.data.documentVersions[document.type];
        const [stored] = await transaction
          .select({ id: privacyDocuments.id })
          .from(privacyDocuments)
          .where(
            and(
              eq(privacyDocuments.type, document.type),
              eq(privacyDocuments.version, requestedVersion),
              isNull(privacyDocuments.retiredAt),
            ),
          )
          .limit(1);
        if (!stored) {
          throw new ApiHttpError(409, 'DOCUMENT_VERSION_INACTIVE', 'Documento desatualizado.');
        }
        await transaction
          .insert(privacyAcceptances)
          .values({
            documentId: stored.id,
            userAgentFamily: userAgentFamily(request.headers['user-agent']),
            userId: user.id,
          })
          .onConflictDoNothing();
      }
    });

    return reply.status(204).send();
  });
}
