/**
 * Gamificação leve: os níveis dependem de consistência e de registro, nunca de dor, esforço máximo
 * ou volume extremo. Os critérios ficam centralizados aqui para facilitar ajustes futuros.
 */
export const LEVEL_CRITERION_KEYS = [
  'concludedSessions',
  'evolutionRecords',
  'longestStreak',
  'regularWeeks',
] as const;

export type LevelCriterionKey = (typeof LEVEL_CRITERION_KEYS)[number];

export const LEVEL_CRITERION_LABELS: Record<LevelCriterionKey, string> = {
  concludedSessions: 'Treinos concluídos',
  evolutionRecords: 'Dias com registro de evolução',
  longestStreak: 'Melhor sequência de treinos',
  regularWeeks: 'Semanas com regularidade',
};

export type LevelCriteria = Record<LevelCriterionKey, number>;

export interface LevelDefinition {
  criteria: LevelCriteria;
  id: string;
  name: string;
}

/** Uma semana conta como regular quando teve pelo menos este número de sessões concluídas. */
export const REGULAR_WEEK_MINIMUM_SESSIONS = 2;

export const LEVEL_DEFINITIONS: readonly LevelDefinition[] = [
  {
    criteria: { concludedSessions: 0, evolutionRecords: 0, longestStreak: 0, regularWeeks: 0 },
    id: 'beginner-1',
    name: 'Iniciante I',
  },
  {
    criteria: { concludedSessions: 4, evolutionRecords: 1, longestStreak: 2, regularWeeks: 1 },
    id: 'beginner-2',
    name: 'Iniciante II',
  },
  {
    criteria: { concludedSessions: 10, evolutionRecords: 2, longestStreak: 3, regularWeeks: 3 },
    id: 'beginner-3',
    name: 'Iniciante III',
  },
  {
    criteria: { concludedSessions: 20, evolutionRecords: 4, longestStreak: 4, regularWeeks: 6 },
    id: 'consistent-1',
    name: 'Consistente I',
  },
  {
    criteria: { concludedSessions: 36, evolutionRecords: 6, longestStreak: 6, regularWeeks: 10 },
    id: 'consistent-2',
    name: 'Consistente II',
  },
  {
    criteria: { concludedSessions: 60, evolutionRecords: 10, longestStreak: 8, regularWeeks: 16 },
    id: 'consistent-3',
    name: 'Consistente III',
  },
];

export type LevelSessionStatus =
  'cancelled' | 'completed' | 'in_progress' | 'missed' | 'partial' | 'planned';

export interface LevelSessionInput {
  localDate: string;
  status: LevelSessionStatus;
  type: 'other' | 'rest' | 'strength' | 'walk';
}

export interface LevelProgressInput {
  measurementDates: string[];
  sessions: LevelSessionInput[];
}

export interface LevelMetrics extends LevelCriteria {
  currentStreak: number;
}

export interface LevelCriterionStatus {
  achieved: boolean;
  key: LevelCriterionKey;
  label: string;
  target: number;
  value: number;
}

export interface LevelStatus {
  achieved: boolean;
  achievedAt: string | null;
  criteria: LevelCriterionStatus[];
  id: string;
  index: number;
  name: string;
}

export interface LevelEvaluation {
  current: LevelStatus;
  levels: LevelStatus[];
  metrics: LevelMetrics;
  next: LevelStatus | null;
  progressToNext: number;
}

const DAY_MS = 86_400_000;

function mondayOf(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function isConcluded(session: LevelSessionInput): boolean {
  return (
    session.type !== 'rest' && (session.status === 'completed' || session.status === 'partial')
  );
}

function countsForStreak(session: LevelSessionInput): boolean {
  return session.type !== 'rest' && ['completed', 'missed', 'partial'].includes(session.status);
}

export function calculateLevelMetrics(input: LevelProgressInput): LevelMetrics {
  const sessions = [...input.sessions].sort((left, right) =>
    left.localDate.localeCompare(right.localDate),
  );
  const concluded = sessions.filter(isConcluded);
  const weekCounts = new Map<string, number>();
  for (const session of concluded) {
    const week = mondayOf(session.localDate);
    weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
  }
  let currentStreak = 0;
  let longestStreak = 0;
  for (const session of sessions.filter(countsForStreak)) {
    if (session.status === 'missed') currentStreak = 0;
    else {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    }
  }
  return {
    concludedSessions: concluded.length,
    currentStreak,
    evolutionRecords: new Set(input.measurementDates).size,
    longestStreak,
    regularWeeks: [...weekCounts.values()].filter((count) => count >= REGULAR_WEEK_MINIMUM_SESSIONS)
      .length,
  };
}

function satisfies(metrics: LevelCriteria, definition: LevelDefinition): boolean {
  return LEVEL_CRITERION_KEYS.every((key) => metrics[key] >= definition.criteria[key]);
}

function criteriaStatus(
  metrics: LevelCriteria,
  definition: LevelDefinition,
): LevelCriterionStatus[] {
  return LEVEL_CRITERION_KEYS.map((key) => ({
    achieved: metrics[key] >= definition.criteria[key],
    key,
    label: LEVEL_CRITERION_LABELS[key],
    target: definition.criteria[key],
    value: metrics[key],
  }));
}

function achievementDates(input: LevelProgressInput): Map<string, string> {
  const dates = [
    ...new Set([...input.sessions.map((session) => session.localDate), ...input.measurementDates]),
  ].sort();
  const achieved = new Map<string, string>();
  for (const date of dates) {
    const metrics = calculateLevelMetrics({
      measurementDates: input.measurementDates.filter((item) => item <= date),
      sessions: input.sessions.filter((session) => session.localDate <= date),
    });
    for (const definition of LEVEL_DEFINITIONS) {
      if (achieved.has(definition.id)) continue;
      if (satisfies(metrics, definition)) achieved.set(definition.id, date);
    }
  }
  return achieved;
}

export function evaluateLevels(input: LevelProgressInput): LevelEvaluation {
  const metrics = calculateLevelMetrics(input);
  const achievedAt = achievementDates(input);
  const levels: LevelStatus[] = LEVEL_DEFINITIONS.map((definition, index) => ({
    achieved: satisfies(metrics, definition),
    achievedAt: achievedAt.get(definition.id) ?? null,
    criteria: criteriaStatus(metrics, definition),
    id: definition.id,
    index,
    name: definition.name,
  }));
  const current = [...levels].reverse().find((level) => level.achieved) ?? levels[0]!;
  const next = levels[current.index + 1] ?? null;
  const progressToNext = next
    ? Math.round(
        (next.criteria.reduce(
          (total, criterion) =>
            total + (criterion.target === 0 ? 1 : Math.min(1, criterion.value / criterion.target)),
          0,
        ) /
          next.criteria.length) *
          10_000,
      ) / 100
    : 100;

  return { current, levels, metrics, next, progressToNext };
}
