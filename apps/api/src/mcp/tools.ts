import {
  MCP_DETAIL_RANGE_DAYS,
  mcpComparePeriodsInputSchema,
  mcpComparePeriodsShape,
  mcpExerciseNameSchema,
  mcpLimitSchema,
  mcpRangeInputSchema,
  mcpRangeShape,
  mcpSessionStatusSchema,
  type McpRangeInput,
} from '@torkout/contracts';
import { userProfiles, type DatabaseClient } from '@torkout/database';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { eq } from 'drizzle-orm';

import { DEFAULT_TIME_ZONE, loadDataSnapshot } from '../data-snapshot.js';
import { daysBetween, resolvePeriod } from './period.js';
import {
  comparePeriods,
  getExerciseProgress,
  getLastWorkout,
  getMeasurementSummary,
  getMeasurements,
  getNutrition,
  getProfile,
  getProgress,
  getRecentChanges,
  getRecovery,
  getTrainingSummary,
  getWalks,
  getWheyHistory,
  getWorkouts,
  type McpQueryContext,
} from './queries.js';

/**
 * Registro das ferramentas MCP.
 *
 * Toda tool desta versão é somente leitura: as anotações declaram `readOnlyHint`, e não existe
 * caminho de escrita. O usuário dono dos dados vem do `userId` fixado na construção do servidor, que
 * por sua vez veio do token verificado — nunca de um argumento.
 */

export interface McpToolDependencies {
  database: DatabaseClient;
  now?: () => Date;
  userId: string;
}

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

/** Um erro de tool devolve texto curto; jamais stack trace, SQL ou detalhe interno. */
function toolFailure(message: string) {
  return {
    content: [{ text: message, type: 'text' as const }],
    isError: true as const,
  };
}

function toolResult(payload: unknown) {
  return {
    content: [{ text: JSON.stringify(payload), type: 'text' as const }],
  };
}

export function createMcpToolRegistrar(dependencies: McpToolDependencies) {
  const clock = dependencies.now ?? (() => new Date());

  async function timeZoneOf(): Promise<string> {
    const [profile] = await dependencies.database
      .select({ timeZone: userProfiles.timeZone })
      .from(userProfiles)
      .where(eq(userProfiles.userId, dependencies.userId))
      .limit(1);
    return profile?.timeZone ?? DEFAULT_TIME_ZONE;
  }

  /**
   * Monta o contexto de consulta. O recorte de datas é resolvido antes da consulta e passado ao
   * carregador, de modo que o banco nunca devolve mais do que o período pedido.
   */
  async function contextFor(range: McpRangeInput): Promise<McpQueryContext> {
    const parsed = mcpRangeInputSchema.parse(range);
    const now = clock();
    const timeZone = await timeZoneOf();
    const period = resolvePeriod(parsed, timeZone, now);
    const snapshot = await loadDataSnapshot(dependencies.database, dependencies.userId, {
      now,
      scope: { from: period.from, through: period.to },
    });
    return { now, period, snapshot };
  }

  async function contextForExplicit(from: string, to: string): Promise<McpQueryContext> {
    return contextFor({ from, to });
  }

  return function register(server: McpServer): void {
    server.registerTool(
      'get_profile',
      {
        annotations: { ...READ_ONLY, title: 'Perfil do usuário' },
        description:
          'Contexto de treino do titular: altura, objetivo declarado, horário preferido, sistema de unidades, fuso e data de início. Não devolve e-mail, senha, hash nem token.',
        inputSchema: {},
      },
      async () => {
        const context = await contextFor({ days: 1 });
        return toolResult(getProfile(context));
      },
    );

    server.registerTool(
      'get_training_summary',
      {
        annotations: { ...READ_ONLY, title: 'Resumo de treino' },
        description:
          'Resumo agregado do período: aderência de força e caminhada, sessões concluídas, parciais, perdidas, canceladas e futuras separadamente, total de séries e repetições, RPE médio, resumo por exercício e contagem de recuperação. Sessões futuras nunca contam como falta.',
        inputSchema: mcpRangeShape,
      },
      async (input) => toolResult(getTrainingSummary(await contextFor(input))),
    );

    server.registerTool(
      'get_workouts',
      {
        annotations: { ...READ_ONLY, title: 'Treinos do período' },
        description:
          'Treinos estruturados do período, do mais recente para o mais antigo, com exercícios, séries planejadas e realizadas, RPE e recuperação associada. Use `limit` para controlar o tamanho da resposta.',
        inputSchema: {
          ...mcpRangeShape,
          exercise: mcpExerciseNameSchema
            .optional()
            .describe('Filtra treinos que contenham este exercício; ignora acentos e maiúsculas.'),
          limit: mcpLimitSchema,
          status: mcpSessionStatusSchema.optional().describe('Filtra por estado da sessão.'),
        },
      },
      async (input) => {
        const context = await contextFor(input);
        if (context.period.days > MCP_DETAIL_RANGE_DAYS) {
          return toolFailure(
            `O período pedido tem ${context.period.days} dias. Acima de ${MCP_DETAIL_RANGE_DAYS} dias use get_training_summary, que devolve o agregado sem carregar cada série.`,
          );
        }
        return toolResult(
          getWorkouts(context, {
            exercise: input.exercise,
            limit: input.limit,
            status: input.status,
          }),
        );
      },
    );

    server.registerTool(
      'get_last_workout',
      {
        annotations: { ...READ_ONLY, title: 'Último treino' },
        description:
          'Treino concluído mais recente, opcionalmente restrito a um exercício. Devolve `workout: null` quando nada foi concluído no período consultado.',
        inputSchema: {
          exercise: mcpExerciseNameSchema
            .optional()
            .describe('Restringe ao treino mais recente que contenha este exercício.'),
        },
      },
      async (input) => {
        // Sem recorte pedido, olha um ano para trás: suficiente para "qual foi meu último treino"
        // sem varrer toda a história da conta.
        const context = await contextFor({ days: 365 });
        return toolResult(getLastWorkout(context, { exercise: input.exercise }));
      },
    );

    server.registerTool(
      'get_exercise_progress',
      {
        annotations: { ...READ_ONLY, title: 'Progressão por exercício' },
        description:
          'Série histórica de um exercício: datas, séries, valor por série, total por treino, maior série, média, volume e tendência simples. Devolve apenas dados e métricas, nunca prescrição de treino.',
        inputSchema: {
          ...mcpRangeShape,
          exercise: mcpExerciseNameSchema.describe('Nome ou parte do nome do exercício.'),
        },
      },
      async (input) =>
        toolResult(getExerciseProgress(await contextFor(input), { exercise: input.exercise })),
    );

    server.registerTool(
      'get_measurements',
      {
        annotations: { ...READ_ONLY, title: 'Medidas corporais' },
        description:
          'Medidas registradas no período: peso, cintura, barriga, quadril, coxa, bíceps, data, horário, jejum e observações. Um valor nulo significa medida não registrada, nunca zero.',
        inputSchema: { ...mcpRangeShape, limit: mcpLimitSchema },
      },
      async (input) => toolResult(getMeasurements(await contextFor(input), { limit: input.limit })),
    );

    server.registerTool(
      'get_measurement_summary',
      {
        annotations: { ...READ_ONLY, title: 'Resumo de medidas' },
        description:
          'Para cada medida: primeiro e último valor, diferença absoluta e percentual, mínimo, máximo e quantidade de registros. Não interpreta oscilações pequenas como ganho ou perda real.',
        inputSchema: mcpRangeShape,
      },
      async (input) => toolResult(getMeasurementSummary(await contextFor(input))),
    );

    server.registerTool(
      'get_walks',
      {
        annotations: { ...READ_ONLY, title: 'Caminhadas' },
        description:
          'Caminhadas do período com data, distância, duração, estado, RPE e observações, mais o resumo de concluídas, parciais, canceladas, distância total, duração total e distância média.',
        inputSchema: mcpRangeShape,
      },
      async (input) => toolResult(getWalks(await contextFor(input))),
    );

    server.registerTool(
      'get_nutrition',
      {
        annotations: { ...READ_ONLY, title: 'Alimentação e hábitos' },
        description:
          'Somente o que o aplicativo realmente registra: estado do café (não consumido, sem açúcar, com açúcar), hábitos configurados pelo titular e presença de whey. Nenhum macronutriente é estimado. Café sem açúcar nunca é somado a café não consumido.',
        inputSchema: mcpRangeShape,
      },
      async (input) => toolResult(getNutrition(await contextFor(input))),
    );

    server.registerTool(
      'get_whey_history',
      {
        annotations: { ...READ_ONLY, title: 'Histórico de whey' },
        description:
          'Registros de whey no período: consumo, quantidade, horário, mistura, volume de líquido, marca, produto, proteína informada, tolerância e observações.',
        inputSchema: { ...mcpRangeShape, limit: mcpLimitSchema },
      },
      async (input) => toolResult(getWheyHistory(await contextFor(input), { limit: input.limit })),
    );

    server.registerTool(
      'get_recovery',
      {
        annotations: { ...READ_ONLY, title: 'Recuperação e dor' },
        description:
          'RPE e registros de desconforto do período, com tipo, intensidade, região, momento, inchaço, dificuldade para apoiar e exercício interrompido. Distingue explicitamente três estados: respondeu "sem dor", relatou desconforto e não respondeu. Ausência de registro nunca é tratada como ausência de dor.',
        inputSchema: { ...mcpRangeShape, limit: mcpLimitSchema },
      },
      async (input) => toolResult(getRecovery(await contextFor(input), { limit: input.limit })),
    );

    server.registerTool(
      'get_progress',
      {
        annotations: { ...READ_ONLY, title: 'Progresso consolidado' },
        description:
          'Visão consolidada do período: treinos concluídos, aderência, sequência atual e melhor sequência, evolução de flexões e agachamentos, peso, cintura, barriga, caminhadas, RPE, recuperação e nível atual.',
        inputSchema: mcpRangeShape,
      },
      async (input) => toolResult(getProgress(await contextFor(input))),
    );

    server.registerTool(
      'compare_periods',
      {
        annotations: { ...READ_ONLY, title: 'Comparação de períodos' },
        description:
          'Compara dois períodos explícitos e devolve, para cada indicador, o valor atual, o anterior, a diferença absoluta e a percentual quando matematicamente válida. Não produz recomendação médica nem prescrição de treino.',
        inputSchema: mcpComparePeriodsShape,
      },
      async (input) => {
        const parsed = mcpComparePeriodsInputSchema.parse(input);
        for (const [from, to] of [
          [parsed.current_from, parsed.current_to],
          [parsed.previous_from, parsed.previous_to],
        ] as const) {
          if (daysBetween(from, to) > MCP_DETAIL_RANGE_DAYS * 2) {
            return toolFailure('Cada período comparado precisa caber em até 360 dias.');
          }
        }
        const [current, previous] = await Promise.all([
          contextForExplicit(parsed.current_from, parsed.current_to),
          contextForExplicit(parsed.previous_from, parsed.previous_to),
        ]);
        return toolResult(comparePeriods({ current, previous }));
      },
    );

    server.registerTool(
      'get_recent_changes',
      {
        annotations: { ...READ_ONLY, title: 'Mudanças recentes' },
        description:
          'Eventos relevantes recentes detectados nos dados: recorde de repetições, novo peso, nova medida, treino perdido, caminhada concluída, dor registrada e whey consumido ou recusado. Apenas detecta mudanças; não diagnostica e não recomenda tratamento.',
        inputSchema: {
          days: mcpRangeShape.days.describe('Janela em dias. Padrão 14.'),
        },
      },
      async (input) => toolResult(getRecentChanges(await contextFor({ days: input.days ?? 14 }))),
    );
  };
}

/**
 * Recursos MCP de leitura. São atalhos para as mesmas consultas, úteis a clientes que anexam
 * contexto sem chamar tool; nenhuma regra nova vive aqui.
 */
export function registerMcpResources(server: McpServer, dependencies: McpToolDependencies): void {
  const clock = dependencies.now ?? (() => new Date());

  async function context(days: number): Promise<McpQueryContext> {
    const now = clock();
    const [profile] = await dependencies.database
      .select({ timeZone: userProfiles.timeZone })
      .from(userProfiles)
      .where(eq(userProfiles.userId, dependencies.userId))
      .limit(1);
    const period = resolvePeriod({ days }, profile?.timeZone ?? DEFAULT_TIME_ZONE, now);
    const snapshot = await loadDataSnapshot(dependencies.database, dependencies.userId, {
      now,
      scope: { from: period.from, through: period.to },
    });
    return { now, period, snapshot };
  }

  server.registerResource(
    'profile',
    'profile://current',
    {
      description: 'Perfil de treino do titular autenticado.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [{ text: JSON.stringify(getProfile(await context(1))), uri: uri.href }],
    }),
  );

  server.registerResource(
    'training-recent',
    'training://recent',
    {
      description: 'Resumo de treino dos últimos catorze dias.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [{ text: JSON.stringify(getTrainingSummary(await context(14))), uri: uri.href }],
    }),
  );

  server.registerResource(
    'progress-summary',
    'progress://summary',
    {
      description: 'Progresso consolidado dos últimos noventa dias.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [{ text: JSON.stringify(getProgress(await context(90))), uri: uri.href }],
    }),
  );
}
