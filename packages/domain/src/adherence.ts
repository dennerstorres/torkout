import { Temporal } from '@js-temporal/polyfill';

export type AdherenceStatus =
  'cancelled' | 'completed' | 'in_progress' | 'missed' | 'partial' | 'planned';

export type AdherenceActivityType = 'other' | 'rest' | 'strength' | 'walk';

/**
 * Uma sessão só entra no denominador depois que o horário planejado (ou o fim do dia local, quando
 * não houve horário) já passou. Sessões futuras nunca são tratadas como perdidas.
 */
export interface AdherenceSessionInput {
  cancellationJustified?: boolean | undefined;
  localDate: string;
  plannedLocalTime?: string | null | undefined;
  status: AdherenceStatus;
  type: AdherenceActivityType;
}

export interface AdherenceInput {
  from: string;
  /** Tolerância em minutos aplicada depois do horário planejado antes de considerar a sessão vencida. */
  graceMinutes?: number | undefined;
  now: string;
  sessions: AdherenceSessionInput[];
  through: string;
  timeZone: string;
}

export interface AdherenceBreakdown {
  cancelled: number;
  completed: number;
  denominator: number;
  due: number;
  future: number;
  missed: number;
  overdue: number;
  partial: number;
  percentage: number | null;
  score: number;
}

export const ADHERENCE_FORMULA_VERSION = 'adherence/v1' as const;

export const ADHERENCE_EXPLANATION =
  'Concluída vale 1; parcial vale 0,5; perdida e vencida sem conclusão valem 0. ' +
  'Cancelamento justificado sai do denominador. Sessões cujo horário planejado ainda não passou ' +
  'não entram no denominador e são informadas apenas como futuras.';

export interface AdherenceResult {
  evaluatedFrom: string;
  evaluatedThrough: string;
  explanation: string;
  formulaVersion: typeof ADHERENCE_FORMULA_VERSION;
  general: AdherenceBreakdown;
  strength: AdherenceBreakdown;
  walk: AdherenceBreakdown;
}

const RESOLVED_STATUSES = new Set<AdherenceStatus>(['cancelled', 'completed', 'missed', 'partial']);

function normalizedTime(value: string | null | undefined): string {
  if (!value) return '23:59:59.999';
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!match) return '23:59:59.999';
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;
}

function deadlineEpochMs(
  session: AdherenceSessionInput,
  timeZone: string,
  graceMinutes: number,
): number {
  return Temporal.PlainDateTime.from(
    `${session.localDate}T${normalizedTime(session.plannedLocalTime)}`,
  )
    .toZonedDateTime(timeZone, { disambiguation: 'compatible' })
    .add({ minutes: graceMinutes })
    .toInstant().epochMilliseconds;
}

function emptyBreakdown(): AdherenceBreakdown {
  return {
    cancelled: 0,
    completed: 0,
    denominator: 0,
    due: 0,
    future: 0,
    missed: 0,
    overdue: 0,
    partial: 0,
    percentage: null,
    score: 0,
  };
}

function accumulate(
  breakdown: AdherenceBreakdown,
  session: AdherenceSessionInput,
  isDue: boolean,
): void {
  if (!isDue) {
    breakdown.future += 1;
    return;
  }
  breakdown.due += 1;
  if (session.status === 'cancelled') {
    breakdown.cancelled += 1;
    if (session.cancellationJustified === false) breakdown.denominator += 1;
    return;
  }
  breakdown.denominator += 1;
  if (session.status === 'completed') {
    breakdown.completed += 1;
    breakdown.score += 1;
  } else if (session.status === 'partial') {
    breakdown.partial += 1;
    breakdown.score += 0.5;
  } else if (session.status === 'missed') {
    breakdown.missed += 1;
  } else {
    breakdown.overdue += 1;
  }
}

function finish(breakdown: AdherenceBreakdown): AdherenceBreakdown {
  breakdown.score = Math.round(breakdown.score * 100) / 100;
  breakdown.percentage =
    breakdown.denominator === 0
      ? null
      : Math.round((breakdown.score / breakdown.denominator) * 10_000) / 100;
  return breakdown;
}

export function calculateAdherence(input: AdherenceInput): AdherenceResult {
  const graceMinutes = input.graceMinutes ?? 0;
  const nowEpochMs = Temporal.Instant.from(input.now).epochMilliseconds;
  const localToday = Temporal.Instant.from(input.now)
    .toZonedDateTimeISO(input.timeZone)
    .toPlainDate()
    .toString();
  const evaluatedThrough = input.through < localToday ? input.through : localToday;

  const strength = emptyBreakdown();
  const walk = emptyBreakdown();
  const general = emptyBreakdown();

  for (const session of input.sessions) {
    if (session.localDate < input.from || session.localDate > input.through) continue;
    if (session.type !== 'strength' && session.type !== 'walk') continue;
    const isDue =
      RESOLVED_STATUSES.has(session.status) ||
      deadlineEpochMs(session, input.timeZone, graceMinutes) <= nowEpochMs;
    accumulate(session.type === 'strength' ? strength : walk, session, isDue);
    accumulate(general, session, isDue);
  }

  return {
    evaluatedFrom: input.from,
    evaluatedThrough,
    explanation: ADHERENCE_EXPLANATION,
    formulaVersion: ADHERENCE_FORMULA_VERSION,
    general: finish(general),
    strength: finish(strength),
    walk: finish(walk),
  };
}
