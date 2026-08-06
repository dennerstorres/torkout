import { AiRequestError } from './operations.js';

/**
 * Tradução da string de consulta HTTP para a entrada tipada das operações.
 *
 * Um parâmetro de URL é sempre texto. Esta camada só converte e recusa o que não é número inteiro;
 * a validação de faixa, de coerência entre `days` e `from`/`to` e de data civil inexistente continua
 * sendo dos schemas compartilhados, para que REST e MCP recusem exatamente as mesmas entradas.
 */

export type QueryString = Record<string, unknown>;

function text(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    throw new AiRequestError('invalid_parameter', `Informe \`${name}\` uma única vez.`);
  }
  if (typeof value !== 'string') {
    throw new AiRequestError('invalid_parameter', `O parâmetro \`${name}\` precisa ser texto.`);
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function integer(value: unknown, name: string): number | undefined {
  const raw = text(value, name);
  if (raw === undefined) return undefined;
  if (!/^-?\d+$/.test(raw)) {
    throw new AiRequestError(
      'invalid_parameter',
      `O parâmetro \`${name}\` precisa ser um número inteiro.`,
    );
  }
  return Number(raw);
}

/** Campos aceitos por toda rota que recebe recorte de período. */
export function parseRangeQuery(query: QueryString): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  const days = integer(query.days, 'days');
  const from = text(query.from, 'from');
  const to = text(query.to, 'to');
  if (days !== undefined) parsed.days = days;
  if (from !== undefined) parsed.from = from;
  if (to !== undefined) parsed.to = to;
  return parsed;
}

export function parseLimit(query: QueryString): Record<string, unknown> {
  const limit = integer(query.limit, 'limit');
  return limit === undefined ? {} : { limit };
}

export function parseExercise(query: QueryString, required: boolean): Record<string, unknown> {
  const exercise = text(query.exercise, 'exercise');
  if (exercise === undefined) {
    if (required) {
      throw new AiRequestError('invalid_parameter', 'Informe o parâmetro `exercise`.');
    }
    return {};
  }
  return { exercise };
}

export function parseStatus(query: QueryString): Record<string, unknown> {
  const status = text(query.status, 'status');
  return status === undefined ? {} : { status };
}

/** Os quatro limites de `compare-periods` são obrigatórios e não têm padrão implícito. */
export function parseComparePeriodsQuery(query: QueryString): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  for (const name of ['current_from', 'current_to', 'previous_from', 'previous_to'] as const) {
    const value = text(query[name], name);
    if (value === undefined) {
      throw new AiRequestError('invalid_parameter', `Informe o parâmetro \`${name}\`.`);
    }
    parsed[name] = value;
  }
  return parsed;
}
