import { dataExportRequestSchema } from '@torkout/contracts';
import type { FastifyInstance } from 'fastify';

import { type ApiDependencies, ApiHttpError, requireAuthenticatedUser } from './auth-routes.js';
import { loadDataSnapshot } from './data-snapshot.js';
import { buildCsvZip } from './export-package.js';
import { buildEvolutionReport } from './evolution-report.js';

export function registerPortabilityRoutes(
  app: FastifyInstance,
  dependencies: ApiDependencies,
): void {
  app.post('/api/v1/exports', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const parsed = dataExportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Pedido de exportação inválido.');
    }
    const generatedAt = new Date();
    // A exportação não recebe recorte de consulta: portabilidade entrega tudo o que existe. A faixa
    // pedida apenas descreve o período no cabeçalho do relatório.
    const data = await loadDataSnapshot(dependencies.database, user.id, {
      now: generatedAt,
      pendingChanges: parsed.data.pendingChanges,
      requestedRange:
        parsed.data.from && parsed.data.through
          ? { from: parsed.data.from, through: parsed.data.through }
          : null,
    });
    const date = generatedAt.toISOString().slice(0, 10);
    if (parsed.data.format === 'json') {
      return reply
        .header('content-disposition', `attachment; filename="torkout-export-${date}.json"`)
        .send(data);
    }
    if (parsed.data.format === 'markdown') {
      return reply
        .type('text/markdown; charset=utf-8')
        .header('content-disposition', 'attachment; filename="RELATORIO_EVOLUCAO.md"')
        .send(buildEvolutionReport(data));
    }
    return reply
      .type('application/zip')
      .header('content-disposition', `attachment; filename="torkout-export-${date}.zip"`)
      .send(buildCsvZip(data, generatedAt));
  });
}
