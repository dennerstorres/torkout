import {
  mcpComparePeriodsShape,
  mcpExerciseNameSchema,
  mcpLimitSchema,
  mcpRangeShape,
  mcpSessionStatusSchema,
} from '@torkout/contracts';
import type { DatabaseClient } from '@torkout/database';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { createQueryContextFactory } from '../ai/context.js';
import { AiRequestError, createAiOperations } from '../ai/operations.js';
import { getProfile, getProgress, getTrainingSummary } from '../ai/queries.js';

/**
 * Registro das ferramentas MCP.
 *
 * Este arquivo é só a fachada do protocolo: nome, descrição, anotação e schema de entrada. A
 * consulta, o recorte de período e as guardas de janela vivem em `../ai/operations.ts`, que as rotas
 * REST de `/api/ai` também usam — não existe segunda implementação de nenhuma regra.
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

/** Erro previsto vira resultado de erro da tool; o inesperado continua subindo para o SDK. */
async function run(operation: () => Promise<unknown>) {
  try {
    return toolResult(await operation());
  } catch (error) {
    if (error instanceof AiRequestError) return toolFailure(error.message);
    throw error;
  }
}

export function createMcpToolRegistrar(dependencies: McpToolDependencies) {
  const operations = createAiOperations(dependencies);

  return function register(server: McpServer): void {
    server.registerTool(
      'get_profile',
      {
        annotations: { ...READ_ONLY, title: 'Perfil do usuário' },
        description:
          'Contexto de treino do titular: altura, objetivo declarado, horário preferido, sistema de unidades, fuso e data de início. Não devolve e-mail, senha, hash nem token.',
        inputSchema: {},
      },
      async () => run(() => operations.getProfile()),
    );

    server.registerTool(
      'get_training_summary',
      {
        annotations: { ...READ_ONLY, title: 'Resumo de treino' },
        description:
          'Resumo agregado do período: aderência de força e caminhada, sessões concluídas, parciais, perdidas, canceladas e futuras separadamente, total de séries e repetições, RPE médio, resumo por exercício e contagem de recuperação. Sessões futuras nunca contam como falta.',
        inputSchema: mcpRangeShape,
      },
      async (input) => run(() => operations.getTrainingSummary(input)),
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
      async (input) => run(() => operations.getWorkouts(input)),
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
      async (input) => run(() => operations.getLastWorkout(input)),
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
      async (input) => run(() => operations.getExerciseProgress(input)),
    );

    server.registerTool(
      'get_measurements',
      {
        annotations: { ...READ_ONLY, title: 'Medidas corporais' },
        description:
          'Medidas registradas no período: peso, cintura, barriga, quadril, coxa, bíceps, data, horário, jejum e observações. Um valor nulo significa medida não registrada, nunca zero.',
        inputSchema: { ...mcpRangeShape, limit: mcpLimitSchema },
      },
      async (input) => run(() => operations.getMeasurements(input)),
    );

    server.registerTool(
      'get_measurement_summary',
      {
        annotations: { ...READ_ONLY, title: 'Resumo de medidas' },
        description:
          'Para cada medida: primeiro e último valor, diferença absoluta e percentual, mínimo, máximo e quantidade de registros. Não interpreta oscilações pequenas como ganho ou perda real.',
        inputSchema: mcpRangeShape,
      },
      async (input) => run(() => operations.getMeasurementSummary(input)),
    );

    server.registerTool(
      'get_walks',
      {
        annotations: { ...READ_ONLY, title: 'Caminhadas' },
        description:
          'Caminhadas do período com data, distância, duração, estado, RPE e observações, mais o resumo de concluídas, parciais, canceladas, distância total, duração total e distância média.',
        inputSchema: mcpRangeShape,
      },
      async (input) => run(() => operations.getWalks(input)),
    );

    server.registerTool(
      'get_nutrition',
      {
        annotations: { ...READ_ONLY, title: 'Alimentação e hábitos' },
        description:
          'Somente o que o aplicativo realmente registra: estado do café (não consumido, sem açúcar, com açúcar), hábitos configurados pelo titular e presença de whey. Nenhum macronutriente é estimado. Café sem açúcar nunca é somado a café não consumido.',
        inputSchema: mcpRangeShape,
      },
      async (input) => run(() => operations.getNutrition(input)),
    );

    server.registerTool(
      'get_whey_history',
      {
        annotations: { ...READ_ONLY, title: 'Histórico de proteína' },
        description:
          'Registros de proteína no período: consumo, formato (pó, pronto para beber, iogurte), quantidade e medida da dose, horário, mistura, volume de líquido, ingredientes batidos junto, marca, produto, proteína informada, tolerância e observações.',
        inputSchema: { ...mcpRangeShape, limit: mcpLimitSchema },
      },
      async (input) => run(() => operations.getWheyHistory(input)),
    );

    server.registerTool(
      'get_recovery',
      {
        annotations: { ...READ_ONLY, title: 'Recuperação e dor' },
        description:
          'RPE e registros de desconforto do período, com tipo, intensidade, região, momento, inchaço, dificuldade para apoiar e exercício interrompido. Distingue explicitamente três estados: respondeu "sem dor", relatou desconforto e não respondeu. Ausência de registro nunca é tratada como ausência de dor.',
        inputSchema: { ...mcpRangeShape, limit: mcpLimitSchema },
      },
      async (input) => run(() => operations.getRecovery(input)),
    );

    server.registerTool(
      'get_progress',
      {
        annotations: { ...READ_ONLY, title: 'Progresso consolidado' },
        description:
          'Visão consolidada do período: treinos concluídos, aderência, sequência atual e melhor sequência, evolução de flexões e agachamentos, peso, cintura, barriga, caminhadas, RPE, recuperação e nível atual.',
        inputSchema: mcpRangeShape,
      },
      async (input) => run(() => operations.getProgress(input)),
    );

    server.registerTool(
      'compare_periods',
      {
        annotations: { ...READ_ONLY, title: 'Comparação de períodos' },
        description:
          'Compara dois períodos explícitos e devolve, para cada indicador, o valor atual, o anterior, a diferença absoluta e a percentual quando matematicamente válida. Não produz recomendação médica nem prescrição de treino.',
        inputSchema: mcpComparePeriodsShape,
      },
      async (input) => run(() => operations.comparePeriods(input)),
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
      async (input) => run(() => operations.getRecentChanges(input)),
    );
  };
}

/**
 * Recursos MCP de leitura. São atalhos para as mesmas consultas, úteis a clientes que anexam
 * contexto sem chamar tool; nenhuma regra nova vive aqui.
 */
export function registerMcpResources(server: McpServer, dependencies: McpToolDependencies): void {
  const contexts = createQueryContextFactory(dependencies);

  server.registerResource(
    'profile',
    'profile://current',
    {
      description: 'Perfil de treino do titular autenticado.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          text: JSON.stringify(getProfile(await contexts.forRange({ days: 1 }))),
          uri: uri.href,
        },
      ],
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
      contents: [
        {
          text: JSON.stringify(getTrainingSummary(await contexts.forRange({ days: 14 }))),
          uri: uri.href,
        },
      ],
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
      contents: [
        {
          text: JSON.stringify(getProgress(await contexts.forRange({ days: 90 }))),
          uri: uri.href,
        },
      ],
    }),
  );
}
