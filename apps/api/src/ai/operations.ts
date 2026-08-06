import {
  MCP_DETAIL_RANGE_DAYS,
  mcpComparePeriodsInputSchema,
  mcpExerciseNameSchema,
  mcpLimitSchema,
  mcpRangeInputSchema,
  mcpSessionStatusSchema,
  type McpComparePeriodsInput,
  type McpRangeInput,
} from '@torkout/contracts';
import { z } from 'zod';

import { createQueryContextFactory, type QueryContextDependencies } from './context.js';
import { daysBetween } from './period.js';
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
  type QueryContext,
} from './queries.js';

/**
 * Operações de leitura, neutras de protocolo.
 *
 * Aqui vivem a validação de entrada, o recorte de período e as guardas de janela — tudo o que antes
 * estava no registro de ferramentas MCP. As ferramentas MCP e as rotas REST de `/api/ai` chamam
 * exatamente estas funções, então uma divergência de regra entre as duas saídas é impossível por
 * construção, e não apenas evitada por disciplina.
 *
 * Nenhuma operação escreve. Nenhuma aceita o dono dos dados como argumento.
 */

/** Erro previsto de requisição: mensagem curta, sem stack, SQL, tabela nem caminho de arquivo. */
export class AiRequestError extends Error {
  constructor(
    readonly code: string,
    override readonly message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'AiRequestError';
  }
}

/** Janela padrão de `get_last_workout`: um ano cobre "qual foi meu último treino" sem varrer tudo. */
export const LAST_WORKOUT_LOOKBACK_DAYS = 365;

/** Janela padrão de `get_recent_changes`. */
export const RECENT_CHANGES_DEFAULT_DAYS = 14;

/** Cada período de `compare_periods` precisa caber nesta janela. */
export const COMPARE_MAX_RANGE_DAYS = MCP_DETAIL_RANGE_DAYS * 2;

function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  // Só a primeira mensagem sai: as do schema já são curtas e em português, e listar todas apenas
  // aumentaria a superfície sem ajudar quem chamou.
  const issue = result.error.issues[0];
  throw new AiRequestError('invalid_parameter', issue?.message ?? 'Parâmetro inválido.');
}

const optionalExerciseSchema = mcpExerciseNameSchema.optional();

const workoutsInputSchema = z.object({
  exercise: optionalExerciseSchema,
  limit: mcpLimitSchema,
  status: mcpSessionStatusSchema.optional(),
});

const exerciseProgressInputSchema = z.object({ exercise: mcpExerciseNameSchema });
const limitOnlyInputSchema = z.object({ limit: mcpLimitSchema });
const lastWorkoutInputSchema = z.object({ exercise: optionalExerciseSchema });
const recentChangesInputSchema = z.object({
  days: z.number().int().min(1).max(730).optional(),
});

export interface AiOperations {
  comparePeriods(input: unknown): Promise<unknown>;
  getExerciseProgress(input: unknown): Promise<unknown>;
  getLastWorkout(input: unknown): Promise<unknown>;
  getMeasurementSummary(input: unknown): Promise<unknown>;
  getMeasurements(input: unknown): Promise<unknown>;
  getNutrition(input: unknown): Promise<unknown>;
  getProfile(): Promise<unknown>;
  getProgress(input: unknown): Promise<unknown>;
  getRecentChanges(input: unknown): Promise<unknown>;
  getRecovery(input: unknown): Promise<unknown>;
  getTrainingSummary(input: unknown): Promise<unknown>;
  getWalks(input: unknown): Promise<unknown>;
  getWheyHistory(input: unknown): Promise<unknown>;
  getWorkouts(input: unknown): Promise<unknown>;
}

export function createAiOperations(dependencies: QueryContextDependencies): AiOperations {
  const contexts = createQueryContextFactory(dependencies);

  /** Resolve o recorte já validado; a janela máxima vira erro de requisição, não exceção crua. */
  async function contextFor(range: McpRangeInput): Promise<QueryContext> {
    try {
      return await contexts.forRange(range);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new AiRequestError('period_too_long', error.message);
      }
      throw error;
    }
  }

  function rangeOf(input: unknown): McpRangeInput {
    return validate(mcpRangeInputSchema, input ?? {});
  }

  async function contextForRange(input: unknown): Promise<QueryContext> {
    return contextFor(rangeOf(input));
  }

  return {
    async comparePeriods(input) {
      const parsed: McpComparePeriodsInput = validate(mcpComparePeriodsInputSchema, input ?? {});
      for (const [from, to] of [
        [parsed.current_from, parsed.current_to],
        [parsed.previous_from, parsed.previous_to],
      ] as const) {
        if (daysBetween(from, to) > COMPARE_MAX_RANGE_DAYS) {
          throw new AiRequestError(
            'period_too_long',
            `Cada período comparado precisa caber em até ${COMPARE_MAX_RANGE_DAYS} dias.`,
          );
        }
      }
      const [current, previous] = await Promise.all([
        contextFor({ from: parsed.current_from, to: parsed.current_to }),
        contextFor({ from: parsed.previous_from, to: parsed.previous_to }),
      ]);
      return comparePeriods({ current, previous });
    },

    async getExerciseProgress(input) {
      const { exercise } = validate(exerciseProgressInputSchema, input ?? {});
      return getExerciseProgress(await contextForRange(input), { exercise });
    },

    async getLastWorkout(input) {
      const { exercise } = validate(lastWorkoutInputSchema, input ?? {});
      const context = await contextFor({ days: LAST_WORKOUT_LOOKBACK_DAYS });
      return getLastWorkout(context, { exercise });
    },

    async getMeasurementSummary(input) {
      return getMeasurementSummary(await contextForRange(input));
    },

    async getMeasurements(input) {
      const { limit } = validate(limitOnlyInputSchema, input ?? {});
      return getMeasurements(await contextForRange(input), { limit });
    },

    async getNutrition(input) {
      return getNutrition(await contextForRange(input));
    },

    async getProfile() {
      return getProfile(await contextFor({ days: 1 }));
    },

    async getProgress(input) {
      return getProgress(await contextForRange(input));
    },

    async getRecentChanges(input) {
      const { days } = validate(recentChangesInputSchema, input ?? {});
      return getRecentChanges(await contextFor({ days: days ?? RECENT_CHANGES_DEFAULT_DAYS }));
    },

    async getRecovery(input) {
      const { limit } = validate(limitOnlyInputSchema, input ?? {});
      return getRecovery(await contextForRange(input), { limit });
    },

    async getTrainingSummary(input) {
      return getTrainingSummary(await contextForRange(input));
    },

    async getWalks(input) {
      return getWalks(await contextForRange(input));
    },

    async getWheyHistory(input) {
      const { limit } = validate(limitOnlyInputSchema, input ?? {});
      return getWheyHistory(await contextForRange(input), { limit });
    },

    async getWorkouts(input) {
      const options = validate(workoutsInputSchema, input ?? {});
      const context = await contextForRange(input);
      // Acima da janela de detalhe a resposta viraria um despejo de séries; a orientação é explícita
      // em vez de silenciosamente truncada.
      if (context.period.days > MCP_DETAIL_RANGE_DAYS) {
        throw new AiRequestError(
          'period_too_long',
          `O período pedido tem ${context.period.days} dias. Acima de ${MCP_DETAIL_RANGE_DAYS} dias use get_training_summary, que devolve o agregado sem carregar cada série.`,
        );
      }
      return getWorkouts(context, {
        exercise: options.exercise,
        limit: options.limit,
        status: options.status,
      });
    },
  };
}
