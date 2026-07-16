export type AnalyticsActivityType = 'other' | 'rest' | 'strength' | 'walk';
export type AnalyticsSessionStatus =
  'cancelled' | 'completed' | 'in_progress' | 'missed' | 'partial' | 'planned';
export type AnalyticsExerciseStatus = 'completed' | 'planned' | 'skipped' | 'stopped';
export type AnalyticsMetric = 'distance' | 'duration' | 'repetitions';

export interface AnalyticsMeasurementInput {
  localDate: string;
  measuredAt: string;
  waistCm?: number | null;
  weightKg?: number | null;
}

export interface AnalyticsPainInput {
  bodyRegion: string;
  createdAt?: string;
  intensity: 'light' | 'moderate' | 'not_informed' | 'strong';
  localDate: string;
  type: 'joint' | 'muscular';
}

export interface AnalyticsSetInput {
  actualDistanceMeters?: number | null;
  actualDurationSeconds?: number | null;
  actualRepetitions?: number | null;
  deleted?: boolean;
}

export interface AnalyticsExerciseInput {
  exerciseId: string | null;
  metric: AnalyticsMetric;
  name: string;
  sets: AnalyticsSetInput[];
  status: AnalyticsExerciseStatus;
}

export interface AnalyticsSessionInput {
  exercises: AnalyticsExerciseInput[];
  localDate: string;
  status: AnalyticsSessionStatus;
  type: AnalyticsActivityType;
  walkingDistanceMeters?: number | null;
}

export interface AnalyticsInput {
  from: string;
  measurements: AnalyticsMeasurementInput[];
  painReports: AnalyticsPainInput[];
  sessions: AnalyticsSessionInput[];
  through: string;
}

const DAY_MS = 86_400_000;

function addDays(localDate: string, days: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function mondayOf(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  return addDays(localDate, -((date.getUTCDay() + 6) % 7));
}

function inRange(localDate: string, input: AnalyticsInput): boolean {
  return localDate >= input.from && localDate <= input.through;
}

function valueForMetric(set: AnalyticsSetInput, metric: AnalyticsMetric): number {
  if (set.deleted) return 0;
  if (metric === 'repetitions') return set.actualRepetitions ?? 0;
  if (metric === 'duration') return set.actualDurationSeconds ?? 0;
  return set.actualDistanceMeters ?? 0;
}

export interface ProgressAnalytics {
  consistency: {
    explanation: string;
    formulaVersion: 'weekly-consistency/v1';
    weeks: Array<{
      completedEquivalent: number;
      percentage: number | null;
      plannedExecutable: number;
      weekEnd: string;
      weekStart: string;
    }>;
  };
  exercises: Array<{
    exerciseId: string | null;
    metric: AnalyticsMetric;
    name: string;
    points: Array<{ localDate: string; value: number }>;
    total: number;
  }>;
  measurements: Array<{
    localDate: string;
    measuredAt: string;
    waistCm: number | null;
    weightKg: number | null;
  }>;
  pain: Array<{
    bodyRegion: string;
    count: number;
    intensity: AnalyticsPainInput['intensity'];
    type: AnalyticsPainInput['type'];
  }>;
  sessions: { completed: number; partial: number };
  walks: { distanceMeters: number; frequencyPerWeek: number; sessions: number };
}

export function calculateProgressAnalytics(input: AnalyticsInput): ProgressAnalytics {
  const sessions = input.sessions.filter((session) => inRange(session.localDate, input));
  const firstWeek = mondayOf(input.from);
  const lastWeek = mondayOf(input.through);
  const weeks: ProgressAnalytics['consistency']['weeks'] = [];
  for (let weekStart = firstWeek; weekStart <= lastWeek; weekStart = addDays(weekStart, 7)) {
    const weekEnd = addDays(weekStart, 6);
    const executable = sessions.filter(
      (session) =>
        session.localDate >= weekStart &&
        session.localDate <= weekEnd &&
        session.type !== 'rest' &&
        session.status !== 'cancelled',
    );
    const completedEquivalent = executable.reduce(
      (total, session) =>
        total + (session.status === 'completed' ? 1 : session.status === 'partial' ? 0.5 : 0),
      0,
    );
    const plannedExecutable = executable.length;
    weeks.push({
      completedEquivalent,
      percentage:
        plannedExecutable === 0
          ? null
          : Math.round((completedEquivalent / plannedExecutable) * 10_000) / 100,
      plannedExecutable,
      weekEnd,
      weekStart,
    });
  }

  const exerciseMap = new Map<string, ProgressAnalytics['exercises'][number]>();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.status === 'skipped') continue;
      const value = exercise.sets.reduce(
        (total, set) => total + valueForMetric(set, exercise.metric),
        0,
      );
      if (value === 0) continue;
      const key = `${exercise.exerciseId ?? exercise.name}:${exercise.metric}`;
      const aggregate = exerciseMap.get(key) ?? {
        exerciseId: exercise.exerciseId,
        metric: exercise.metric,
        name: exercise.name,
        points: [],
        total: 0,
      };
      const point = aggregate.points.find((item) => item.localDate === session.localDate);
      if (point) point.value += value;
      else aggregate.points.push({ localDate: session.localDate, value });
      aggregate.total += value;
      exerciseMap.set(key, aggregate);
    }
  }

  const walkSessions = sessions.filter(
    (session) =>
      session.type === 'walk' && (session.status === 'completed' || session.status === 'partial'),
  );
  const painMap = new Map<string, ProgressAnalytics['pain'][number]>();
  for (const report of input.painReports.filter((item) => inRange(item.localDate, input))) {
    const key = `${report.type}:${report.intensity}:${report.bodyRegion}`;
    const aggregate = painMap.get(key) ?? {
      bodyRegion: report.bodyRegion,
      count: 0,
      intensity: report.intensity,
      type: report.type,
    };
    aggregate.count += 1;
    painMap.set(key, aggregate);
  }

  return {
    consistency: {
      explanation:
        'Concluída vale 1, parcial vale 0,5 e perdida vale 0; descanso e cancelamento não entram no denominador.',
      formulaVersion: 'weekly-consistency/v1',
      weeks,
    },
    exercises: [...exerciseMap.values()]
      .map((exercise) => ({
        ...exercise,
        points: exercise.points.sort((left, right) =>
          left.localDate.localeCompare(right.localDate),
        ),
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    measurements: input.measurements
      .filter((item) => inRange(item.localDate, input))
      .map((item) => ({
        localDate: item.localDate,
        measuredAt: item.measuredAt,
        waistCm: item.waistCm ?? null,
        weightKg: item.weightKg ?? null,
      }))
      .sort((left, right) => left.measuredAt.localeCompare(right.measuredAt)),
    pain: [...painMap.values()].sort((left, right) =>
      `${left.type}:${left.intensity}:${left.bodyRegion}`.localeCompare(
        `${right.type}:${right.intensity}:${right.bodyRegion}`,
      ),
    ),
    sessions: {
      completed: sessions.filter((session) => session.status === 'completed').length,
      partial: sessions.filter((session) => session.status === 'partial').length,
    },
    walks: {
      distanceMeters: walkSessions.reduce(
        (total, session) => total + (session.walkingDistanceMeters ?? 0),
        0,
      ),
      frequencyPerWeek:
        weeks.length === 0 ? 0 : Math.round((walkSessions.length / weeks.length) * 100) / 100,
      sessions: walkSessions.length,
    },
  };
}
