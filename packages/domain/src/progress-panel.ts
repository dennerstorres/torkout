import { Temporal } from '@js-temporal/polyfill';

import {
  calculateAdherence,
  type AdherenceActivityType,
  type AdherenceResult,
  type AdherenceStatus,
} from './adherence.js';
import { evaluateLevels, type LevelEvaluation } from './levels.js';

export type RecoveryStatus = 'none' | 'not_answered' | 'reported';
export type DiscomfortType = 'joint' | 'muscular' | 'other';

export interface ProgressPanelExercise {
  metric: 'distance' | 'duration' | 'repetitions';
  name: string;
  sets: number[];
  status: 'completed' | 'planned' | 'skipped' | 'stopped';
}

export interface ProgressPanelSession {
  cancellationJustified?: boolean | undefined;
  exercises: ProgressPanelExercise[];
  localDate: string;
  perceivedExertion?: number | null | undefined;
  plannedLocalTime?: string | null | undefined;
  recoveryStatus?: RecoveryStatus | undefined;
  status: AdherenceStatus;
  type: AdherenceActivityType;
  walkDistanceMeters?: number | null | undefined;
  walkDurationSeconds?: number | null | undefined;
}

export interface ProgressPanelMeasurement {
  abdomenCm?: number | null | undefined;
  localDate: string;
  waistCm?: number | null | undefined;
  weightKg?: number | null | undefined;
}

export interface ProgressPanelPain {
  localDate: string;
  type: DiscomfortType;
}

export interface ProgressPanelInput {
  from: string;
  measurements: ProgressPanelMeasurement[];
  now: string;
  painReports: ProgressPanelPain[];
  sessions: ProgressPanelSession[];
  through: string;
  timeZone: string;
}

export interface MeasurementTrend {
  delta: number;
  first: { localDate: string; value: number };
  last: { localDate: string; value: number };
}

export interface ProgressPanel {
  abdomen: MeasurementTrend | null;
  adherence: AdherenceResult;
  averagePerceivedExertion: number | null;
  bestSet: { exercise: string; localDate: string; repetitions: number } | null;
  concludedSessions: number;
  currentStreak: number;
  jointPainReports: number;
  levels: LevelEvaluation;
  longestStreak: number;
  muscularPainReports: number;
  otherDiscomfortReports: number;
  perceivedExertionSamples: number;
  pushUpsPerSession: Array<{ localDate: string; repetitions: number }>;
  sessionsThisWeek: number;
  sessionsWithoutPain: number;
  squatsPerSession: Array<{ localDate: string; repetitions: number }>;
  strengthSessionsThisWeek: number;
  waist: MeasurementTrend | null;
  walkDistanceMeters: number;
  walkDurationSeconds: number;
  walksConcluded: number;
  weight: MeasurementTrend | null;
}

const DAY_MS = 86_400_000;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function mondayOf(localDate: string): string {
  const date = new Date(`${localDate}T00:00:00Z`);
  return new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function addDays(localDate: string, amount: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00Z`) + amount * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function inRange(localDate: string, input: ProgressPanelInput): boolean {
  return localDate >= input.from && localDate <= input.through;
}

function isConcluded(session: ProgressPanelSession): boolean {
  return (
    session.type !== 'rest' && (session.status === 'completed' || session.status === 'partial')
  );
}

function repetitionTotals(
  sessions: ProgressPanelSession[],
  matches: (name: string) => boolean,
): Array<{ localDate: string; repetitions: number }> {
  const totals = new Map<string, number>();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      if (exercise.metric !== 'repetitions' || !matches(normalize(exercise.name))) continue;
      if (exercise.status === 'skipped') continue;
      const total = exercise.sets.reduce((sum, value) => sum + (value || 0), 0);
      if (total === 0) continue;
      totals.set(session.localDate, (totals.get(session.localDate) ?? 0) + total);
    }
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([localDate, repetitions]) => ({ localDate, repetitions }));
}

function trendOf(
  measurements: ProgressPanelMeasurement[],
  key: 'abdomenCm' | 'waistCm' | 'weightKg',
): MeasurementTrend | null {
  const points = measurements
    .map((measurement) => ({
      localDate: measurement.localDate,
      value: measurement[key] ?? null,
    }))
    .filter((point): point is { localDate: string; value: number } => point.value !== null)
    .sort((left, right) => left.localDate.localeCompare(right.localDate));
  if (points.length === 0) return null;
  const first = points[0]!;
  const last = points.at(-1)!;
  return { delta: round(last.value - first.value), first, last };
}

export function summarizeProgressPanel(input: ProgressPanelInput): ProgressPanel {
  const sessions = input.sessions.filter((session) => inRange(session.localDate, input));
  const concluded = sessions.filter(isConcluded);
  const measurements = input.measurements.filter((item) => inRange(item.localDate, input));
  const pains = input.painReports.filter((item) => inRange(item.localDate, input));

  const localToday = Temporal.Instant.from(input.now)
    .toZonedDateTimeISO(input.timeZone)
    .toPlainDate()
    .toString();
  const weekStart = mondayOf(localToday);
  const weekEnd = addDays(weekStart, 6);
  const inCurrentWeek = (session: ProgressPanelSession): boolean =>
    session.localDate >= weekStart && session.localDate <= weekEnd;

  const levels = evaluateLevels({
    measurementDates: measurements.map((measurement) => measurement.localDate),
    sessions: sessions.map((session) => ({
      localDate: session.localDate,
      status: session.status,
      type: session.type,
    })),
  });

  const bestSetCandidates = sessions.flatMap((session) =>
    session.exercises
      .filter((exercise) => exercise.metric === 'repetitions' && exercise.status !== 'skipped')
      .flatMap((exercise) =>
        exercise.sets
          .filter((value) => Number.isFinite(value) && value > 0)
          .map((repetitions) => ({
            exercise: exercise.name,
            localDate: session.localDate,
            repetitions,
          })),
      ),
  );
  const bestSet =
    bestSetCandidates.length === 0
      ? null
      : bestSetCandidates.reduce((best, candidate) =>
          candidate.repetitions > best.repetitions ? candidate : best,
        );

  const exertionValues = sessions
    .map((session) => session.perceivedExertion)
    .filter((value): value is number => typeof value === 'number');

  const walks = concluded.filter((session) => session.type === 'walk');

  return {
    abdomen: trendOf(measurements, 'abdomenCm'),
    adherence: calculateAdherence({
      from: input.from,
      now: input.now,
      sessions: sessions.map((session) => ({
        cancellationJustified: session.cancellationJustified,
        localDate: session.localDate,
        plannedLocalTime: session.plannedLocalTime,
        status: session.status,
        type: session.type,
      })),
      through: input.through,
      timeZone: input.timeZone,
    }),
    averagePerceivedExertion:
      exertionValues.length === 0
        ? null
        : round(exertionValues.reduce((total, value) => total + value, 0) / exertionValues.length),
    bestSet,
    concludedSessions: concluded.length,
    currentStreak: levels.metrics.currentStreak,
    jointPainReports: pains.filter((pain) => pain.type === 'joint').length,
    levels,
    longestStreak: levels.metrics.longestStreak,
    muscularPainReports: pains.filter((pain) => pain.type === 'muscular').length,
    otherDiscomfortReports: pains.filter((pain) => pain.type === 'other').length,
    perceivedExertionSamples: exertionValues.length,
    pushUpsPerSession: repetitionTotals(sessions, (name) => name.includes('flexao')),
    sessionsThisWeek: concluded.filter(inCurrentWeek).length,
    sessionsWithoutPain: sessions.filter((session) => session.recoveryStatus === 'none').length,
    squatsPerSession: repetitionTotals(sessions, (name) => name.includes('agachamento')),
    strengthSessionsThisWeek: concluded.filter(
      (session) => session.type === 'strength' && inCurrentWeek(session),
    ).length,
    waist: trendOf(measurements, 'waistCm'),
    walkDistanceMeters: walks.reduce(
      (total, session) => total + (session.walkDistanceMeters ?? 0),
      0,
    ),
    walkDurationSeconds: walks.reduce(
      (total, session) => total + (session.walkDurationSeconds ?? 0),
      0,
    ),
    walksConcluded: walks.length,
    weight: trendOf(measurements, 'weightKg'),
  };
}
