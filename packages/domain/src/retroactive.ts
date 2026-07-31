import { Temporal } from '@js-temporal/polyfill';

export type RetroactiveDecisionInput = {
  /** Data local da sessão que está sendo lançada. */
  readonly plannedLocalDate: string;
  /** Instante real em que o lançamento está acontecendo. */
  readonly loggedAt: string;
  readonly timeZone: string;
  /** Marca já gravada; nunca é descartada. */
  readonly alreadyLoggedAt?: string | null | undefined;
};

export type RetroactiveDecision =
  | { readonly allowed: true; readonly retroactivelyLoggedAt: string | null }
  | { readonly allowed: false; readonly reason: 'future_date' };

export type RetroactiveCountable = {
  readonly status: string;
  readonly retroactivelyLoggedAt?: string | null | undefined;
};

/** Estados que representam trabalho efetivamente realizado. */
const LOGGED_STATUSES = new Set(['completed', 'partial']);

function localDateOf(instant: string, timeZone: string): string {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

/**
 * Decide se um lançamento é aceito e qual marca de retroatividade a sessão passa a
 * carregar. A marca é imutável: uma vez gravada, nenhuma edição posterior a apaga,
 * nem mesmo uma correção feita na própria data da sessão.
 */
export function decideRetroactiveLog(input: RetroactiveDecisionInput): RetroactiveDecision {
  const today = localDateOf(input.loggedAt, input.timeZone);
  if (input.plannedLocalDate > today) return { allowed: false, reason: 'future_date' };
  const existing = input.alreadyLoggedAt ?? null;
  if (existing !== null) return { allowed: true, retroactivelyLoggedAt: existing };
  return {
    allowed: true,
    retroactivelyLoggedAt: input.plannedLocalDate < today ? input.loggedAt : null,
  };
}

/** Quantas conclusões do conjunto foram lançadas depois da data em que ocorreram. */
export function countRetroactiveCompletions(sessions: readonly RetroactiveCountable[]): number {
  return sessions.filter(
    (session) =>
      LOGGED_STATUSES.has(session.status) &&
      session.retroactivelyLoggedAt !== null &&
      session.retroactivelyLoggedAt !== undefined,
  ).length;
}
