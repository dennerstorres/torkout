import { MCP_MAX_RANGE_DAYS, type McpPeriod, type McpRangeInput } from '@torkout/contracts';
import { instantToLocalDate } from '@torkout/domain';

const DAY_MS = 86_400_000;

/** Padrão quando a pergunta não traz recorte: duas semanas cobrem a conversa típica sem exagero. */
export const DEFAULT_RANGE_DAYS = 14;

export function addDays(localDate: string, amount: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00Z`) + amount * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function daysBetween(from: string, through: string): number {
  if (through < from) return 0;
  return (
    Math.round((Date.parse(`${through}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
  );
}

/**
 * Converte o recorte pedido em datas civis no fuso do usuário.
 *
 * O "hoje" nasce de `instantToLocalDate`, nunca de `toISOString().slice(0, 10)` sobre o relógio do
 * servidor: em `America/Cuiaba` são fusos distintos por boa parte do dia, e usar UTC deslocaria toda
 * pergunta feita à noite para o dia seguinte.
 */
export function resolvePeriod(range: McpRangeInput, timeZone: string, now: Date): McpPeriod {
  const today = instantToLocalDate(now.toISOString(), timeZone);
  if (range.from !== undefined && range.to !== undefined) {
    const span = daysBetween(range.from, range.to);
    if (span > MCP_MAX_RANGE_DAYS) {
      throw new RangeError(
        `O período pedido tem ${span} dias e o máximo é ${MCP_MAX_RANGE_DAYS}. Peça um intervalo menor ou use uma tool de resumo.`,
      );
    }
    return { days: span, from: range.from, time_zone: timeZone, to: range.to };
  }
  const days = range.days ?? DEFAULT_RANGE_DAYS;
  return { days, from: addDays(today, -(days - 1)), time_zone: timeZone, to: today };
}

export function isWithin(localDate: string | null, period: McpPeriod): boolean {
  return localDate !== null && localDate >= period.from && localDate <= period.to;
}
