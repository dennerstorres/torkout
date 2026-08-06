import type { McpRangeInput } from '@torkout/contracts';
import { userProfiles, type DatabaseClient } from '@torkout/database';
import { eq } from 'drizzle-orm';

import { DEFAULT_TIME_ZONE, loadDataSnapshot } from '../data-snapshot.js';
import { resolvePeriod } from './period.js';
import type { QueryContext } from './queries.js';

/**
 * Montagem do contexto de leitura, compartilhada pelas ferramentas MCP e pelas rotas REST.
 *
 * O `userId` é fixado na construção, a partir da credencial já verificada. Nenhum argumento de
 * chamada participa dessa decisão, nem no MCP nem no REST.
 */
export interface QueryContextDependencies {
  database: DatabaseClient;
  now?: (() => Date) | undefined;
  userId: string;
}

export interface QueryContextFactory {
  /** Contexto de um recorte pedido, já resolvido no fuso do titular. */
  forRange(range: McpRangeInput): Promise<QueryContext>;
  timeZone(): Promise<string>;
}

export function createQueryContextFactory(
  dependencies: QueryContextDependencies,
): QueryContextFactory {
  const clock = dependencies.now ?? (() => new Date());

  async function timeZone(): Promise<string> {
    const [profile] = await dependencies.database
      .select({ timeZone: userProfiles.timeZone })
      .from(userProfiles)
      .where(eq(userProfiles.userId, dependencies.userId))
      .limit(1);
    return profile?.timeZone ?? DEFAULT_TIME_ZONE;
  }

  return {
    /**
     * O recorte de datas é resolvido antes da consulta e passado ao carregador, de modo que o banco
     * nunca devolva mais do que o período pedido — uma pergunta sobre catorze dias não carrega anos
     * de séries.
     */
    async forRange(range: McpRangeInput): Promise<QueryContext> {
      const now = clock();
      const period = resolvePeriod(range, await timeZone(), now);
      const snapshot = await loadDataSnapshot(dependencies.database, dependencies.userId, {
        now,
        scope: { from: period.from, through: period.to },
      });
      return { now, period, snapshot };
    },
    timeZone,
  };
}
