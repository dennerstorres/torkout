import {
  MCP_DEFAULT_LIMIT,
  MCP_MAX_LIMIT,
  type DataExport,
  type McpPeriod,
} from '@torkout/contracts';
import {
  ADHERENCE_EXPLANATION,
  calculateAdherence,
  recoveryDeservesAttention,
  summarizeProgressPanel,
  type AdherenceBreakdown,
  type AdherenceSessionInput,
} from '@torkout/domain';

import { daysBetween, isWithin } from './period.js';

/**
 * Camada de leitura do MCP. Só transforma o retrato já carregado do banco em JSON previsível;
 * nenhuma função aqui escreve, e nenhuma emite juízo, recomendação ou prescrição — a interpretação é
 * responsabilidade de quem conversa com o modelo.
 */

type Row = Record<string, unknown>;

export interface McpQueryContext {
  now: Date;
  period: McpPeriod;
  snapshot: DataExport;
}

/**
 * Aviso repetido nas tools de recuperação. O modelo precisa da distinção explícita: um dia sem linha
 * de dor não é um dia sem dor, é um dia sem resposta.
 */
export const RECOVERY_ABSENCE_NOTICE =
  'Ausência de registro nunca significa ausência de dor. Só as sessões com resposta explícita contam como "sem dor".';

const REPETITION_METRIC = 'repetitions';

function rows(collection: Row[]): Row[] {
  return collection.filter((row) => row.deletedAt == null);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function localDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? null;
}

function clock(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value);
  return match ? `${match[1]}:${match[2]}` : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function flag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function boundedLimit(limit: number | undefined): number {
  if (limit === undefined) return MCP_DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.trunc(limit)), MCP_MAX_LIMIT);
}

/** Diferença percentual só existe quando a base é diferente de zero. */
function percentDelta(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null || previous === 0) return null;
  return round(((current - previous) / Math.abs(previous)) * 100);
}

function comparison(previous: number | null, current: number | null) {
  return {
    current,
    delta: previous === null || current === null ? null : round(current - previous),
    delta_percent: percentDelta(previous, current),
    previous,
  };
}

function sessionsInPeriod(context: McpQueryContext): Row[] {
  return rows(context.snapshot.entities.workoutSessions as Row[])
    .filter((session) => isWithin(localDate(session.plannedLocalDate), context.period))
    .sort((left, right) =>
      String(left.plannedLocalDate).localeCompare(String(right.plannedLocalDate)),
    );
}

function adherenceInputs(sessions: Row[], fallbackDate: string): AdherenceSessionInput[] {
  return sessions.map((session) => ({
    localDate: localDate(session.plannedLocalDate) ?? fallbackDate,
    plannedLocalTime: text(session.suggestedLocalTime),
    status: String(session.status ?? 'planned') as AdherenceSessionInput['status'],
    type: String(session.type ?? 'other') as AdherenceSessionInput['type'],
  }));
}

function breakdownView(breakdown: AdherenceBreakdown) {
  return {
    adherence_percent: breakdown.percentage,
    cancelled: breakdown.cancelled,
    completed: breakdown.completed,
    denominator: breakdown.denominator,
    due: breakdown.due,
    future_not_counted: breakdown.future,
    missed: breakdown.missed,
    overdue_unresolved: breakdown.overdue,
    partial: breakdown.partial,
  };
}

/** Junta cada sessão aos seus exercícios e séries, na ordem registrada. */
function exercisesOf(context: McpQueryContext, sessionId: unknown) {
  const sets = rows(context.snapshot.entities.exerciseSets as Row[]);
  return rows(context.snapshot.entities.sessionExercises as Row[])
    .filter((item) => item.sessionId === sessionId)
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
    .map((item) => {
      const metric = String(item.trackingMetricSnapshot ?? REPETITION_METRIC);
      const own = sets
        .filter((entry) => entry.sessionExerciseId === item.id)
        .sort((left, right) => Number(left.setNumber ?? 0) - Number(right.setNumber ?? 0));
      return {
        metric,
        name: String(item.exerciseNameSnapshot ?? ''),
        sets: own.map((entry) => ({
          actual:
            metric === REPETITION_METRIC
              ? num(entry.actualRepetitions)
              : metric === 'duration'
                ? num(entry.actualDurationSeconds)
                : num(entry.actualDistanceMeters),
          completed: flag(entry.completed),
          planned:
            metric === REPETITION_METRIC
              ? num(entry.plannedRepetitions)
              : metric === 'duration'
                ? num(entry.plannedDurationSeconds)
                : num(entry.plannedDistanceMeters),
          set_number: num(entry.setNumber),
        })),
        status: String(item.status ?? 'planned'),
        total_actual: own.reduce((total, entry) => {
          const value =
            metric === REPETITION_METRIC
              ? num(entry.actualRepetitions)
              : metric === 'duration'
                ? num(entry.actualDurationSeconds)
                : num(entry.actualDistanceMeters);
          return total + (value ?? 0);
        }, 0),
      };
    });
}

function painReportsOf(context: McpQueryContext, sessionId: unknown): Row[] {
  return rows(context.snapshot.entities.painReports as Row[]).filter(
    (report) => report.sessionId === sessionId,
  );
}

function painView(report: Row) {
  return {
    body_region:
      report.bodyRegion === 'other' ? text(report.customBodyRegion) : text(report.bodyRegion),
    date: localDate(report.localDate),
    deserves_attention: recoveryDeservesAttention({
      intensityScore: num(report.intensityScore),
      supportDifficulty: flag(report.supportDifficulty),
      swelling: flag(report.swelling),
      type: (text(report.type) as 'joint' | 'muscular' | 'other') ?? 'other',
    }),
    exercise_stopped: flag(report.exerciseStopped),
    id: text(report.id),
    intensity: text(report.intensity),
    intensity_score: num(report.intensityScore),
    moment: text(report.moment),
    notes: text(report.notes),
    session_id: text(report.sessionId),
    support_difficulty: flag(report.supportDifficulty),
    swelling: flag(report.swelling),
    type: text(report.type),
  };
}

function workoutView(context: McpQueryContext, session: Row) {
  const walk = rows(context.snapshot.entities.walkingDetails as Row[]).find(
    (item) => item.sessionId === session.id,
  );
  return {
    date: localDate(session.plannedLocalDate),
    exercises: exercisesOf(context, session.id),
    id: text(session.id),
    logged_after_the_fact: text(session.retroactivelyLoggedAt) !== null,
    notes: text(session.notes),
    perceived_exertion: num(session.perceivedExertion),
    planned_time: clock(session.suggestedLocalTime),
    recovery: {
      pain_reports: painReportsOf(context, session.id).map(painView),
      // `not_answered` significa que a pergunta não foi respondida, não que não houve dor.
      status: String(session.recoveryStatus ?? 'not_answered'),
    },
    source: text(session.source),
    status: String(session.status ?? 'planned'),
    template: text(session.templateNameSnapshot),
    type: String(session.type ?? 'other'),
    ...(walk
      ? {
          walk: {
            distance_meters: num(walk.actualDistanceMeters),
            duration_seconds: num(walk.durationSeconds),
            planned_distance_meters: num(walk.plannedDistanceMeters),
          },
        }
      : {}),
  };
}

function matchesExercise(context: McpQueryContext, session: Row, needle: string): boolean {
  const wanted = normalize(needle);
  return rows(context.snapshot.entities.sessionExercises as Row[]).some(
    (item) =>
      item.sessionId === session.id && normalize(item.exerciseNameSnapshot).includes(wanted),
  );
}

export function getProfile(context: McpQueryContext) {
  const profile = rows(context.snapshot.entities.userProfiles as Row[])[0];
  return {
    goal: text(profile?.goal),
    height_cm: num(profile?.heightCm),
    locale: text(profile?.locale),
    preferred_workout_time: clock(profile?.preferredWorkoutTime),
    started_at: localDate(context.snapshot.account.createdAt),
    time_zone: context.snapshot.timeZone,
    unit_system: text(profile?.unitSystem) ?? 'metric',
    units: context.snapshot.units,
    week_starts_on: num(profile?.weekStartsOn),
  };
}

export function getTrainingSummary(context: McpQueryContext) {
  const sessions = sessionsInPeriod(context);
  const adherence = calculateAdherence({
    from: context.period.from,
    now: context.now.toISOString(),
    sessions: adherenceInputs(sessions, context.period.from),
    through: context.period.to,
    timeZone: context.period.time_zone,
  });

  const perExercise = new Map<
    string,
    { best_set: number | null; sessions: number; sets: number; total_repetitions: number }
  >();
  let totalSets = 0;
  let totalRepetitions = 0;
  for (const session of sessions) {
    for (const item of exercisesOf(context, session.id)) {
      if (item.status === 'skipped') continue;
      totalSets += item.sets.length;
      const aggregate = perExercise.get(item.name) ?? {
        best_set: null,
        sessions: 0,
        sets: 0,
        total_repetitions: 0,
      };
      aggregate.sessions += 1;
      aggregate.sets += item.sets.length;
      if (item.metric === REPETITION_METRIC) {
        totalRepetitions += item.total_actual;
        aggregate.total_repetitions += item.total_actual;
        for (const entry of item.sets) {
          if (
            entry.actual !== null &&
            (aggregate.best_set === null || entry.actual > aggregate.best_set)
          ) {
            aggregate.best_set = entry.actual;
          }
        }
      }
      perExercise.set(item.name, aggregate);
    }
  }

  const answerable = sessions.filter(
    (session) => session.type === 'strength' || session.type === 'walk',
  );
  const exertion = sessions
    .map((session) => num(session.perceivedExertion))
    .filter((value): value is number => value !== null);
  const pains = rows(context.snapshot.entities.painReports as Row[]).filter((report) =>
    isWithin(localDate(report.localDate), context.period),
  );

  return {
    adherence_explanation: ADHERENCE_EXPLANATION,
    evaluated_period: {
      days: daysBetween(adherence.evaluatedFrom, adherence.evaluatedThrough),
      from: adherence.evaluatedFrom,
      time_zone: context.period.time_zone,
      to: adherence.evaluatedThrough,
    },
    exercises: Object.fromEntries(
      [...perExercise.entries()].sort(([left], [right]) => left.localeCompare(right, 'pt-BR')),
    ),
    general: breakdownView(adherence.general),
    perceived_exertion: {
      average:
        exertion.length === 0 ? null : round(exertion.reduce((a, b) => a + b, 0) / exertion.length),
      samples: exertion.length,
    },
    recovery: {
      joint_pain_reports: pains.filter((report) => report.type === 'joint').length,
      muscular_pain_reports: pains.filter((report) => report.type === 'muscular').length,
      notice: RECOVERY_ABSENCE_NOTICE,
      other_discomfort_reports: pains.filter((report) => report.type === 'other').length,
      sessions_answered_without_pain: answerable.filter((s) => s.recoveryStatus === 'none').length,
      sessions_with_discomfort_reported: answerable.filter((s) => s.recoveryStatus === 'reported')
        .length,
      sessions_without_recovery_answer: answerable.filter(
        (s) => s.recoveryStatus !== 'none' && s.recoveryStatus !== 'reported',
      ).length,
    },
    requested_period: context.period,
    strength: breakdownView(adherence.strength),
    totals: {
      distinct_exercises: perExercise.size,
      repetitions: totalRepetitions,
      sets: totalSets,
    },
    walk: breakdownView(adherence.walk),
  };
}

export interface GetWorkoutsOptions {
  exercise?: string | undefined;
  limit?: number | undefined;
  status?: string | undefined;
}

export function getWorkouts(context: McpQueryContext, options: GetWorkoutsOptions) {
  const limit = boundedLimit(options.limit);
  let sessions = sessionsInPeriod(context);
  if (options.status) sessions = sessions.filter((s) => s.status === options.status);
  if (options.exercise) {
    const needle = options.exercise;
    sessions = sessions.filter((session) => matchesExercise(context, session, needle));
  }
  // Mais recentes primeiro: a pergunta conversacional quase sempre olha para trás a partir de hoje.
  const ordered = [...sessions].reverse();
  const page = ordered.slice(0, limit);
  return {
    limit,
    period: context.period,
    returned: page.length,
    total_in_period: sessions.length,
    truncated: sessions.length > page.length,
    workouts: page.map((session) => workoutView(context, session)),
  };
}

export function getLastWorkout(
  context: McpQueryContext,
  options: { exercise?: string | undefined },
) {
  let concluded = sessionsInPeriod(context).filter(
    (session) => session.status === 'completed' || session.status === 'partial',
  );
  if (options.exercise) {
    const needle = options.exercise;
    concluded = concluded.filter((session) => matchesExercise(context, session, needle));
  }
  const last = concluded.at(-1);
  return {
    period: context.period,
    workout: last ? workoutView(context, last) : null,
  };
}

export function getExerciseProgress(context: McpQueryContext, options: { exercise: string }) {
  const wanted = normalize(options.exercise);
  const perSession: Array<{
    best_set: number | null;
    date: string | null;
    metric: string;
    sets: Array<number | null>;
    total: number;
  }> = [];

  for (const session of sessionsInPeriod(context)) {
    for (const item of exercisesOf(context, session.id)) {
      if (!normalize(item.name).includes(wanted) || item.status === 'skipped') continue;
      const values = item.sets.map((entry) => entry.actual);
      const recorded = values.filter((value): value is number => value !== null);
      perSession.push({
        best_set: recorded.length === 0 ? null : Math.max(...recorded),
        date: localDate(session.plannedLocalDate),
        metric: item.metric,
        sets: values,
        total: item.total_actual,
      });
    }
  }

  const totals = perSession.map((entry) => entry.total);
  const bestSets = perSession
    .map((entry) => entry.best_set)
    .filter((value): value is number => value !== null);
  const first = perSession[0] ?? null;
  const last = perSession.at(-1) ?? null;

  // Tendência é descrição do que está registrado, não avaliação de qualidade do treino.
  let trend: 'decreasing' | 'increasing' | 'insufficient_data' | 'stable' = 'insufficient_data';
  if (perSession.length >= 2 && first && last) {
    if (last.total > first.total) trend = 'increasing';
    else if (last.total < first.total) trend = 'decreasing';
    else trend = 'stable';
  }

  return {
    average_per_session:
      totals.length === 0 ? null : round(totals.reduce((a, b) => a + b, 0) / totals.length),
    best_set: bestSets.length === 0 ? null : Math.max(...bestSets),
    exercise: options.exercise,
    first,
    last,
    period: context.period,
    sessions: perSession,
    total_volume: totals.reduce((a, b) => a + b, 0),
    trend,
  };
}

function measurementRows(context: McpQueryContext): Row[] {
  return rows(context.snapshot.entities.bodyMeasurements as Row[])
    .filter((row) => isWithin(localDate(row.localDate), context.period))
    .sort((left, right) => String(left.localDate).localeCompare(String(right.localDate)));
}

/** Chaves adicionais reconhecidas dentro de `additionalMeasurements`. */
const ADDITIONAL_KEYS: Record<string, string> = {
  arm: 'biceps_cm',
  biceps: 'biceps_cm',
  bracо: 'biceps_cm',
  coxa: 'thigh_cm',
  gluteo: 'hip_cm',
  hip: 'hip_cm',
  quadril: 'hip_cm',
  thigh: 'thigh_cm',
};

function additionalOf(row: Row): Record<string, number | null> {
  const result: Record<string, number | null> = {
    biceps_cm: null,
    hip_cm: null,
    thigh_cm: null,
  };
  const extras = Array.isArray(row.additionalMeasurements)
    ? (row.additionalMeasurements as Row[])
    : [];
  for (const extra of extras) {
    const key = ADDITIONAL_KEYS[normalize(extra.key)] ?? ADDITIONAL_KEYS[normalize(extra.label)];
    if (key) result[key] = num(extra.value);
  }
  return result;
}

export function getMeasurements(context: McpQueryContext, options: { limit?: number | undefined }) {
  const limit = boundedLimit(options.limit);
  const all = measurementRows(context);
  const page = [...all].reverse().slice(0, limit);
  return {
    limit,
    measurements: page.map((row) => ({
      ...additionalOf(row),
      abdomen_cm: num(row.abdomenCm),
      date: localDate(row.localDate),
      fasting: flag(row.fasting),
      id: text(row.id),
      notes: text(row.notes),
      time: typeof row.measuredAt === 'string' ? clock(row.measuredAt.slice(11, 16)) : null,
      waist_cm: num(row.waistCm),
      weight_kg: num(row.weightKg),
    })),
    note: 'Um valor nulo significa medida não registrada, nunca zero.',
    period: context.period,
    returned: page.length,
    total_in_period: all.length,
    truncated: all.length > page.length,
  };
}

const SUMMARY_MEASURES = {
  abdomen_cm: 'abdomenCm',
  biceps_cm: 'biceps_cm',
  hip_cm: 'hip_cm',
  thigh_cm: 'thigh_cm',
  waist_cm: 'waistCm',
  weight_kg: 'weightKg',
} as const;

export type MeasureKey = keyof typeof SUMMARY_MEASURES;

export interface MeasureSummary {
  count: number;
  delta: number;
  delta_percent: number | null;
  first: number;
  first_date: string | null;
  last: number;
  last_date: string | null;
  max: number;
  min: number;
}

export type MeasurementSummary = Record<MeasureKey, MeasureSummary | null> & {
  note: string;
  period: McpPeriod;
};

export function getMeasurementSummary(context: McpQueryContext): MeasurementSummary {
  const all = measurementRows(context);
  const measures = {} as Record<MeasureKey, MeasureSummary | null>;

  for (const output of Object.keys(SUMMARY_MEASURES) as MeasureKey[]) {
    const column = SUMMARY_MEASURES[output];
    const points = all
      .map((row) => {
        const value =
          column === 'biceps_cm' || column === 'hip_cm' || column === 'thigh_cm'
            ? additionalOf(row)[column]
            : num(row[column]);
        return { date: localDate(row.localDate), value };
      })
      .filter((point): point is { date: string | null; value: number } => point.value != null);

    if (points.length === 0) {
      measures[output] = null;
      continue;
    }
    const values = points.map((point) => point.value);
    const first = points[0]!;
    const last = points.at(-1)!;
    measures[output] = {
      count: points.length,
      delta: round(last.value - first.value),
      delta_percent: percentDelta(first.value, last.value),
      first: first.value,
      first_date: first.date,
      last: last.value,
      last_date: last.date,
      max: Math.max(...values),
      min: Math.min(...values),
    };
  }

  return {
    ...measures,
    note: 'Oscilações pequenas não são interpretadas como ganho ou perda real.',
    period: context.period,
  };
}

export function getWalks(context: McpQueryContext) {
  const walkDetails = rows(context.snapshot.entities.walkingDetails as Row[]);
  const sessions = sessionsInPeriod(context).filter((session) => session.type === 'walk');
  const walks = sessions.map((session) => {
    const detail = walkDetails.find((item) => item.sessionId === session.id);
    return {
      date: localDate(session.plannedLocalDate),
      distance_meters: num(detail?.actualDistanceMeters),
      duration_seconds: num(detail?.durationSeconds),
      id: text(session.id),
      notes: text(detail?.notes) ?? text(session.notes),
      perceived_exertion: num(session.perceivedExertion),
      planned_distance_meters: num(detail?.plannedDistanceMeters),
      status: String(session.status ?? 'planned'),
    };
  });

  const concluded = walks.filter((walk) => walk.status === 'completed');
  const distances = walks
    .map((walk) => walk.distance_meters)
    .filter((value): value is number => value !== null);

  return {
    period: context.period,
    summary: {
      average_distance_meters:
        distances.length === 0
          ? null
          : round(distances.reduce((a, b) => a + b, 0) / distances.length),
      cancelled: walks.filter((walk) => walk.status === 'cancelled').length,
      completed: concluded.length,
      missed: walks.filter((walk) => walk.status === 'missed').length,
      partial: walks.filter((walk) => walk.status === 'partial').length,
      total_distance_meters: distances.reduce((a, b) => a + b, 0),
      total_duration_seconds: walks.reduce(
        (total, walk) => total + (walk.duration_seconds ?? 0),
        0,
      ),
    },
    walks,
  };
}

export function getNutrition(context: McpQueryContext) {
  const coffee = rows(context.snapshot.entities.coffeeIntakes as Row[]).filter((row) =>
    isWithin(localDate(row.localDate), context.period),
  );
  const counts = { not_consumed: 0, with_sugar: 0, without_sugar: 0 };
  for (const row of coffee) {
    const status = String(row.status);
    if (status in counts) counts[status as keyof typeof counts] += 1;
  }

  const definitions = rows(context.snapshot.entities.habitDefinitions as Row[]);
  const options = new Map(
    rows(context.snapshot.entities.habitOptions as Row[]).map((option) => [
      option.id,
      option.label,
    ]),
  );
  const entries = rows(context.snapshot.entities.habitEntries as Row[])
    .filter((row) => isWithin(localDate(row.localDate), context.period))
    .sort((left, right) => String(left.localDate).localeCompare(String(right.localDate)));

  const habits = entries.map((entry) => {
    const definition = definitions.find((item) => item.id === entry.habitDefinitionId);
    const value =
      entry.booleanValue != null
        ? entry.booleanValue
        : entry.numericValue != null
          ? num(entry.numericValue)
          : entry.textValue != null
            ? text(entry.textValue)
            : entry.selectedOptionId != null
              ? (options.get(entry.selectedOptionId) ?? null)
              : null;
    return {
      date: localDate(entry.localDate),
      habit: text(definition?.name),
      notes: text(entry.notes),
      type: text(definition?.type),
      unit: text(definition?.unit),
      value,
    };
  });

  const whey = rows(context.snapshot.entities.wheyIntakes as Row[]).filter((row) =>
    isWithin(localDate(row.localDate), context.period),
  );

  return {
    coffee: {
      ...counts,
      days_without_record: Math.max(0, context.period.days - coffee.length),
      note: 'Café sem açúcar é consumo registrado; nunca é somado a "não consumi". Um dia sem linha é ausência de registro.',
    },
    habits,
    // Macronutrientes não são calculados: o produto registra hábitos, não quantidades de alimento.
    macronutrients: null,
    note: 'Somente hábitos efetivamente registrados no aplicativo. Nenhum macronutriente é estimado.',
    period: context.period,
    whey: {
      days_consumed: whey.filter((row) => row.consumed === true).length,
      days_recorded: whey.length,
      days_declined: whey.filter((row) => row.consumed === false).length,
    },
  };
}

export function getWheyHistory(context: McpQueryContext, options: { limit?: number | undefined }) {
  const limit = boundedLimit(options.limit);
  const all = rows(context.snapshot.entities.wheyIntakes as Row[])
    .filter((row) => isWithin(localDate(row.localDate), context.period))
    .sort((left, right) => String(left.localDate).localeCompare(String(right.localDate)));
  const page = [...all].reverse().slice(0, limit);

  return {
    entries: page.map((row) => ({
      brand: text(row.brand),
      consumed: flag(row.consumed),
      date: localDate(row.localDate),
      id: text(row.id),
      liquid_ml: num(row.liquidMl),
      mixed_with: row.mixedWith === 'other' ? text(row.customMixedWith) : text(row.mixedWith),
      moment: text(row.moment),
      notes: text(row.notes),
      powder_grams: num(row.powderGrams),
      product: text(row.product),
      protein_per_serving_grams: num(row.proteinPerServingGrams),
      servings: num(row.servings),
      time: clock(row.localTime),
      tolerance: Array.isArray(row.tolerance) ? (row.tolerance as string[]) : [],
    })),
    limit,
    period: context.period,
    returned: page.length,
    total_in_period: all.length,
    truncated: all.length > page.length,
  };
}

export function getRecovery(context: McpQueryContext, options: { limit?: number | undefined }) {
  const limit = boundedLimit(options.limit);
  const sessions = sessionsInPeriod(context);
  const answerable = sessions.filter(
    (session) => session.type === 'strength' || session.type === 'walk',
  );
  const all = rows(context.snapshot.entities.painReports as Row[])
    .filter((report) => isWithin(localDate(report.localDate), context.period))
    .sort((left, right) => String(left.localDate).localeCompare(String(right.localDate)));
  const page = [...all].reverse().slice(0, limit);

  const exertion = sessions
    .map((session) => ({
      date: localDate(session.plannedLocalDate),
      perceived_exertion: num(session.perceivedExertion),
      session_id: text(session.id),
    }))
    .filter((entry) => entry.perceived_exertion !== null);

  return {
    answers: {
      explicitly_without_pain: answerable.filter((s) => s.recoveryStatus === 'none').length,
      not_answered: answerable.filter(
        (s) => s.recoveryStatus !== 'none' && s.recoveryStatus !== 'reported',
      ).length,
      reported_discomfort: answerable.filter((s) => s.recoveryStatus === 'reported').length,
      total_answerable_sessions: answerable.length,
    },
    counts: {
      deserving_attention: all.filter((report) =>
        recoveryDeservesAttention({
          intensityScore: num(report.intensityScore),
          supportDifficulty: flag(report.supportDifficulty),
          swelling: flag(report.swelling),
          type: (text(report.type) as 'joint' | 'muscular' | 'other') ?? 'other',
        }),
      ).length,
      joint: all.filter((report) => report.type === 'joint').length,
      muscular: all.filter((report) => report.type === 'muscular').length,
      other: all.filter((report) => report.type === 'other').length,
    },
    limit,
    notice: RECOVERY_ABSENCE_NOTICE,
    perceived_exertion: exertion,
    period: context.period,
    reports: page.map(painView),
    returned: page.length,
    total_in_period: all.length,
    truncated: all.length > page.length,
  };
}

export function getProgress(context: McpQueryContext) {
  const sessions = sessionsInPeriod(context);
  const measurements = measurementRows(context);
  const panel = summarizeProgressPanel({
    from: context.period.from,
    measurements: measurements.map((row) => ({
      abdomenCm: num(row.abdomenCm),
      localDate: localDate(row.localDate) ?? context.period.from,
      waistCm: num(row.waistCm),
      weightKg: num(row.weightKg),
    })),
    now: context.now.toISOString(),
    painReports: rows(context.snapshot.entities.painReports as Row[])
      .filter((report) => isWithin(localDate(report.localDate), context.period))
      .map((report) => ({
        localDate: localDate(report.localDate) ?? context.period.from,
        type: (text(report.type) as 'joint' | 'muscular' | 'other') ?? 'other',
      })),
    sessions: sessions.map((session) => ({
      exercises: exercisesOf(context, session.id).map((item) => ({
        metric: item.metric as 'distance' | 'duration' | 'repetitions',
        name: item.name,
        sets: item.sets.map((entry) => entry.actual ?? 0),
        status: item.status as 'completed' | 'planned' | 'skipped' | 'stopped',
      })),
      localDate: localDate(session.plannedLocalDate) ?? context.period.from,
      perceivedExertion: num(session.perceivedExertion),
      plannedLocalTime: text(session.suggestedLocalTime),
      recoveryStatus: String(session.recoveryStatus ?? 'not_answered') as
        'none' | 'not_answered' | 'reported',
      status: String(session.status ?? 'planned') as AdherenceSessionInput['status'],
      type: String(session.type ?? 'other') as AdherenceSessionInput['type'],
      walkDistanceMeters: null,
      walkDurationSeconds: null,
    })),
    through: context.period.to,
    timeZone: context.period.time_zone,
  });

  const summary = getMeasurementSummary(context);
  return {
    adherence: {
      explanation: ADHERENCE_EXPLANATION,
      general: breakdownView(panel.adherence.general),
      strength: breakdownView(panel.adherence.strength),
      walk: breakdownView(panel.adherence.walk),
    },
    best_set: panel.bestSet,
    exercises: {
      push_ups_per_session: panel.pushUpsPerSession,
      squats_per_session: panel.squatsPerSession,
    },
    level: {
      achieved_at: panel.levels.current.achievedAt,
      current: panel.levels.current.name,
      next: panel.levels.next?.name ?? null,
      progress_to_next_percent: panel.levels.next ? panel.levels.progressToNext : 100,
    },
    measurements: {
      abdomen_cm: summary.abdomen_cm,
      waist_cm: summary.waist_cm,
      weight_kg: summary.weight_kg,
    },
    perceived_exertion: {
      average: panel.averagePerceivedExertion,
      samples: panel.perceivedExertionSamples,
    },
    period: context.period,
    recovery: {
      joint_pain_reports: panel.jointPainReports,
      muscular_pain_reports: panel.muscularPainReports,
      notice: RECOVERY_ABSENCE_NOTICE,
      other_discomfort_reports: panel.otherDiscomfortReports,
      sessions_answered_without_pain: panel.sessionsWithoutPain,
    },
    streak: { best: panel.longestStreak, current: panel.currentStreak },
    walks: getWalks(context).summary,
    workouts: {
      completed: sessions.filter((session) => session.status === 'completed').length,
      concluded: panel.concludedSessions,
      partial: sessions.filter((session) => session.status === 'partial').length,
    },
  };
}

export function comparePeriods(input: { current: McpQueryContext; previous: McpQueryContext }) {
  const current = getTrainingSummary(input.current);
  const previous = getTrainingSummary(input.previous);
  const currentMeasures = getMeasurementSummary(input.current);
  const previousMeasures = getMeasurementSummary(input.previous);
  const currentWalks = getWalks(input.current).summary;
  const previousWalks = getWalks(input.previous).summary;

  const exerciseNames = new Set([
    ...Object.keys(current.exercises),
    ...Object.keys(previous.exercises),
  ]);
  const exercises = Object.fromEntries(
    [...exerciseNames]
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))
      .map((name) => [
        name,
        comparison(
          previous.exercises[name]?.total_repetitions ?? 0,
          current.exercises[name]?.total_repetitions ?? 0,
        ),
      ]),
  );

  const measure = (key: MeasureKey) =>
    comparison(previousMeasures[key]?.last ?? null, currentMeasures[key]?.last ?? null);

  return {
    adherence_percent: comparison(
      previous.strength.adherence_percent,
      current.strength.adherence_percent,
    ),
    exercises,
    note: 'Comparação descritiva dos dados registrados. Não contém recomendação de treino nem avaliação clínica.',
    perceived_exertion: comparison(
      previous.perceived_exertion.average,
      current.perceived_exertion.average,
    ),
    periods: { current: input.current.period, previous: input.previous.period },
    recovery: {
      explicitly_without_pain: comparison(
        previous.recovery.sessions_answered_without_pain,
        current.recovery.sessions_answered_without_pain,
      ),
      joint_pain_reports: comparison(
        previous.recovery.joint_pain_reports,
        current.recovery.joint_pain_reports,
      ),
      muscular_pain_reports: comparison(
        previous.recovery.muscular_pain_reports,
        current.recovery.muscular_pain_reports,
      ),
      notice: RECOVERY_ABSENCE_NOTICE,
    },
    total_repetitions: comparison(previous.totals.repetitions, current.totals.repetitions),
    total_sets: comparison(previous.totals.sets, current.totals.sets),
    walks: {
      completed: comparison(previousWalks.completed, currentWalks.completed),
      total_distance_meters: comparison(
        previousWalks.total_distance_meters,
        currentWalks.total_distance_meters,
      ),
    },
    workouts_completed: comparison(previous.strength.completed, current.strength.completed),
    abdomen_cm: measure('abdomen_cm'),
    waist_cm: measure('waist_cm'),
    weight_kg: measure('weight_kg'),
  };
}

/**
 * Detecta eventos recentes nos dados. Só descreve o que mudou; não diagnostica e não recomenda.
 */
export function getRecentChanges(context: McpQueryContext) {
  const events: Array<{ date: string | null; detail: Record<string, unknown>; kind: string }> = [];
  const sessions = sessionsInPeriod(context);

  let bestSoFar = 0;
  for (const session of sessions) {
    const date = localDate(session.plannedLocalDate);
    if (session.status === 'missed') {
      events.push({
        date,
        detail: { template: text(session.templateNameSnapshot) },
        kind: 'workout_missed',
      });
    }
    if (session.type === 'walk' && session.status === 'completed') {
      const detail = rows(context.snapshot.entities.walkingDetails as Row[]).find(
        (item) => item.sessionId === session.id,
      );
      events.push({
        date,
        detail: { distance_meters: num(detail?.actualDistanceMeters) },
        kind: 'walk_completed',
      });
    }
    for (const item of exercisesOf(context, session.id)) {
      if (item.metric !== REPETITION_METRIC) continue;
      for (const entry of item.sets) {
        if (entry.actual !== null && entry.actual > bestSoFar) {
          bestSoFar = entry.actual;
          events.push({
            date,
            detail: { exercise: item.name, repetitions: entry.actual },
            kind: 'repetition_record',
          });
        }
      }
    }
  }

  for (const row of measurementRows(context)) {
    const date = localDate(row.localDate);
    if (num(row.weightKg) !== null) {
      events.push({ date, detail: { weight_kg: num(row.weightKg) }, kind: 'weight_recorded' });
    }
    if (num(row.waistCm) !== null || num(row.abdomenCm) !== null) {
      events.push({
        date,
        detail: { abdomen_cm: num(row.abdomenCm), waist_cm: num(row.waistCm) },
        kind: 'measurement_recorded',
      });
    }
  }

  for (const report of rows(context.snapshot.entities.painReports as Row[]).filter((row) =>
    isWithin(localDate(row.localDate), context.period),
  )) {
    events.push({
      date: localDate(report.localDate),
      detail: painView(report),
      kind: 'pain_recorded',
    });
  }

  for (const row of rows(context.snapshot.entities.wheyIntakes as Row[]).filter((item) =>
    isWithin(localDate(item.localDate), context.period),
  )) {
    events.push({
      date: localDate(row.localDate),
      detail: { consumed: flag(row.consumed) },
      kind: row.consumed === true ? 'whey_consumed' : 'whey_declined',
    });
  }

  return {
    events: events.sort((left, right) => String(right.date).localeCompare(String(left.date))),
    note: 'Detecção descritiva de mudanças nos dados registrados. Não é diagnóstico nem recomendação.',
    period: context.period,
    total: events.length,
  };
}
