import { z } from 'zod';

/**
 * Contratos das ferramentas MCP. Esta versão é estritamente de leitura: nenhum schema aqui descreve
 * criação, alteração ou remoção de registro.
 *
 * Nenhum schema aceita `userId`, `email` ou equivalente. O dono dos dados vem sempre da credencial
 * autenticada; aceitar esse dado como argumento seria oferecer ao modelo um caminho para pedir dados
 * de outra pessoa.
 */

/** Escopo único do servidor. Qualquer outro valor pedido é recusado no `/oauth/authorize`. */
export const MCP_SCOPE = 'torkout:read' as const;

/** Teto de registros detalhados por chamada, para que uma pergunta não devolva anos de séries. */
export const MCP_MAX_LIMIT = 100;
export const MCP_DEFAULT_LIMIT = 20;

/** Janela máxima consultável de uma vez, em dias. */
export const MCP_MAX_RANGE_DAYS = 730;

/** Acima deste número de dias, tools detalhadas degradam para resumo agregado. */
export const MCP_DETAIL_RANGE_DAYS = 180;

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato YYYY-MM-DD.')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Data civil inexistente.');

/**
 * Recorte de período. `days` conta para trás a partir de hoje no fuso do usuário; `from`/`to`
 * descrevem um intervalo explícito. Informar `days` junto de `from` ou `to` é ambíguo e recusado,
 * em vez de resolvido por precedência silenciosa.
 */
export const mcpRangeInputSchema = z
  .object({
    days: z
      .number()
      .int('Informe um número inteiro de dias.')
      .min(1, 'O período precisa ter pelo menos um dia.')
      .max(MCP_MAX_RANGE_DAYS, `O período não pode passar de ${MCP_MAX_RANGE_DAYS} dias.`)
      .optional(),
    from: localDateSchema.optional(),
    to: localDateSchema.optional(),
  })
  .refine(
    (input) => !(input.days !== undefined && (input.from !== undefined || input.to !== undefined)),
    { message: 'Informe `days` ou o par `from`/`to`, nunca os dois.', path: ['days'] },
  )
  .refine((input) => (input.from === undefined) === (input.to === undefined), {
    message: 'Informe `from` e `to` juntos.',
    path: ['to'],
  })
  .refine((input) => input.from === undefined || input.to === undefined || input.from <= input.to, {
    message: 'O início do período não pode ser posterior ao fim.',
    path: ['from'],
  });

export type McpRangeInput = z.infer<typeof mcpRangeInputSchema>;

/** Forma achatada usada pelas tools: o SDK expõe cada chave como propriedade do JSON Schema. */
export const mcpRangeShape = {
  days: z
    .number()
    .int()
    .min(1)
    .max(MCP_MAX_RANGE_DAYS)
    .optional()
    .describe('Número de dias contados para trás a partir de hoje, no fuso do usuário.'),
  from: localDateSchema.optional().describe('Início do período, YYYY-MM-DD, inclusivo.'),
  to: localDateSchema.optional().describe('Fim do período, YYYY-MM-DD, inclusivo.'),
} as const;

export const mcpLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(MCP_MAX_LIMIT)
  .optional()
  .describe(`Máximo de registros detalhados. Padrão ${MCP_DEFAULT_LIMIT}, teto ${MCP_MAX_LIMIT}.`);

export const mcpExerciseNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome do exercício.')
  .max(120, 'Nome de exercício longo demais.');

export const mcpSessionStatuses = [
  'cancelled',
  'completed',
  'in_progress',
  'missed',
  'partial',
  'planned',
] as const;

export const mcpSessionStatusSchema = z.enum(mcpSessionStatuses);

export const mcpComparePeriodsShape = {
  current_from: localDateSchema.describe('Início do período atual, YYYY-MM-DD.'),
  current_to: localDateSchema.describe('Fim do período atual, YYYY-MM-DD.'),
  previous_from: localDateSchema.describe('Início do período anterior, YYYY-MM-DD.'),
  previous_to: localDateSchema.describe('Fim do período anterior, YYYY-MM-DD.'),
} as const;

export const mcpComparePeriodsInputSchema = z
  .object(mcpComparePeriodsShape)
  .refine((input) => input.current_from <= input.current_to, {
    message: 'O início do período atual não pode ser posterior ao fim.',
    path: ['current_from'],
  })
  .refine((input) => input.previous_from <= input.previous_to, {
    message: 'O início do período anterior não pode ser posterior ao fim.',
    path: ['previous_from'],
  });

export type McpComparePeriodsInput = z.infer<typeof mcpComparePeriodsInputSchema>;

/** Nomes das tools desta versão, na ordem em que são registradas. */
export const MCP_TOOL_NAMES = [
  'get_profile',
  'get_training_summary',
  'get_workouts',
  'get_last_workout',
  'get_exercise_progress',
  'get_measurements',
  'get_measurement_summary',
  'get_walks',
  'get_nutrition',
  'get_whey_history',
  'get_recovery',
  'get_progress',
  'compare_periods',
  'get_recent_changes',
] as const;

export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

/** Período efetivamente analisado, devolvido por toda tool que recebe recorte. */
export const mcpPeriodSchema = z.strictObject({
  days: z.number().int().min(1),
  from: z.string(),
  time_zone: z.string(),
  to: z.string(),
});

export type McpPeriod = z.infer<typeof mcpPeriodSchema>;
