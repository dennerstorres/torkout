import { privacyAcceptances, privacyDocuments } from '@torkout/database';
import { privacyAcceptanceSchema } from '@torkout/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';

export const PUBLIC_PRIVACY_DOCUMENTS = [
  {
    content: `Controlador: o responsável pela instância Torkout identificada no domínio oficial da aplicação. O canal de privacidade e a identificação jurídica aplicável são publicados nesse mesmo domínio.

Dados tratados: identidade e contato da conta; perfil; planos, sessões, séries e caminhadas; hábitos; peso e cintura; registros de dor e observações; aceites; dados técnicos mínimos de sessão, segurança, sincronização e auditoria. Senhas são armazenadas somente como hash e dados de saúde são privados por padrão.

Finalidades e bases: prestar as funções solicitadas, manter autenticação e sincronização, produzir indicadores e sugestões opcionais, atender exportação/exclusão e proteger o serviço. Dados necessários à conta são tratados para execução do serviço; registros de saúde dependem de consentimento explícito; segurança e prevenção de abuso usam o mínimo necessário.

Compartilhamento: não há venda nem uso publicitário. Operadores de infraestrutura, e-mail e backup recebem somente o necessário, sob configuração e acesso restritos. Transferências dependem da localização desses operadores e das salvaguardas aplicáveis.

Retenção: dados ativos permanecem enquanto a conta existir ou a finalidade exigir. A exclusão remove acesso e dados ativos após confirmação. Backups isolados seguem 7 cópias diárias, 5 semanais e 12 mensais, limitados a 365 dias, sem retorno ao produto ativo salvo recuperação de desastre.

Direitos: o titular pode consultar, corrigir, exportar e excluir dados pela aplicação, revogar o consentimento mediante encerramento da conta e solicitar informações pelo canal de privacidade do domínio oficial. Solicitações podem exigir confirmação de identidade. Incidentes relevantes serão comunicados conforme a obrigação aplicável.`,
    title: 'Aviso de privacidade',
    type: 'privacy_notice',
    version: '2026-07-15',
  },
  {
    content: `O Torkout oferece planejamento, registro local-first, sincronização, histórico, indicadores e sugestões opcionais. O serviço não substitui profissional de saúde ou educação física, não diagnostica, não prescreve tratamento e não atende emergências.

O usuário deve fornecer dados corretos, proteger sua conta e dispositivos e usar o serviço de forma lícita. É proibido tentar acessar outra conta, contornar limites, explorar vulnerabilidades ou interferir na disponibilidade. Contas envolvidas em abuso podem ser temporariamente bloqueadas e sessões revogadas.

Conexões, navegadores e dispositivos podem falhar. Alterações offline são preservadas localmente e sincronizadas quando possível, mas IndexedDB não substitui backup. A disponibilidade pode ser interrompida para manutenção, segurança ou recuperação. O titular deve revisar conflitos e sugestões antes de aceitá-las.

O titular pode exportar seus dados e excluir a conta. O encerramento revoga o acesso e observa a retenção de backups declarada no aviso de privacidade. Mudanças materiais destes termos geram nova versão e novo aceite quando aplicável. Limitações de responsabilidade e lei aplicável seguem as normas obrigatórias da jurisdição do responsável pela instância, sem afastar direitos indisponíveis do titular.`,
    title: 'Termos de uso',
    type: 'terms',
    version: '2026-07-15',
  },
  {
    content: `Ao aceitar, você autoriza o tratamento dos registros que decidir fornecer sobre treino, séries, caminhada, hábitos, peso, cintura, dor muscular ou articular e observações para executar as funções do Torkout, sincronizar seus dispositivos, exibir histórico/indicadores e produzir sugestões conservadoras e opcionais.

O preenchimento de medidas, dor e observações é opcional, salvo confirmações necessárias à regra escolhida. Ausência de relato não é interpretada como ausência de dor. O Torkout não diagnostica causas, não recomenda tratamento e não substitui orientação médica, fisioterapêutica, nutricional ou de educação física.

Você pode corrigir, exportar ou excluir os registros. Pode revogar este consentimento encerrando a conta; a revogação impede novos tratamentos no produto ativo e não invalida operações legítimas anteriores, obrigações de segurança nem a expiração das cópias isoladas descritas no aviso de privacidade.`,
    title: 'Consentimento para dados de saúde',
    type: 'health_data_consent',
    version: '2026-07-15',
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
