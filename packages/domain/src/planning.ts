import { Temporal } from '@js-temporal/polyfill';

import { localDateTimeToInstant, validateIanaTimeZone } from './time.js';

export type TrackingMetric = 'distance' | 'duration' | 'repetitions';
export type WorkoutType = 'other' | 'rest' | 'strength' | 'walk';
export type WorkoutStatus =
  'cancelled' | 'completed' | 'in_progress' | 'missed' | 'partial' | 'planned';

export interface PlanningSet {
  setNumber: number;
  targetDistanceMeters?: number;
  targetDurationSeconds?: number;
  targetRepetitions?: number;
}

export interface PlanningExercise {
  exerciseId: string;
  name: string;
  notes?: string | null;
  sets: PlanningSet[];
  sortOrder: number;
  trackingMetric: TrackingMetric;
}

export interface PlanningTemplate {
  exercises: PlanningExercise[];
  id: string;
  name: string;
  notes?: string | null;
  type: WorkoutType;
}

export interface PlanningRule {
  id: string;
  localTime: string;
  template: PlanningTemplate;
  timeZone: string;
  validFrom: string;
  validUntil: string | null;
  /** ISO weekday: Monday = 1 and Sunday = 7. */
  weekday: number;
}

export interface MaterializedWorkoutSession {
  exercises: PlanningExercise[];
  id: string;
  plannedInstant: string;
  plannedLocalDate: string;
  scheduleRuleId: string | null;
  source: 'ad_hoc' | 'progression' | 'scheduled';
  status: WorkoutStatus;
  suggestedLocalTime: string | null;
  templateId: string | null;
  templateNameSnapshot: string;
  timeZone: string;
  type: WorkoutType;
}

interface MaterializeInput {
  existing: MaterializedWorkoutSession[];
  from: string;
  idFor(key: string): string;
  rules: PlanningRule[];
  through: string;
}

function cloneExercises(exercises: PlanningExercise[]): PlanningExercise[] {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  }));
}

function sessionKey(ruleId: string, date: string): string {
  return `${ruleId}:${date}`;
}

export function materializeWorkoutSessions(input: MaterializeInput): MaterializedWorkoutSession[] {
  const from = Temporal.PlainDate.from(input.from);
  const through = Temporal.PlainDate.from(input.through);
  if (Temporal.PlainDate.compare(through, from) < 0) {
    throw new Error('A data final da materialização deve ser igual ou posterior à inicial.');
  }

  const sessions = input.existing.map((session) => ({
    ...session,
    exercises: cloneExercises(session.exercises),
  }));
  const existingKeys = new Set(
    sessions
      .filter((session) => session.scheduleRuleId !== null)
      .map((session) => sessionKey(session.scheduleRuleId!, session.plannedLocalDate)),
  );

  for (const rule of input.rules) {
    validateIanaTimeZone(rule.timeZone);
    if (!Number.isInteger(rule.weekday) || rule.weekday < 1 || rule.weekday > 7) {
      throw new Error('Dia da semana deve usar ISO: segunda = 1 e domingo = 7.');
    }
    const validFrom = Temporal.PlainDate.from(rule.validFrom);
    const validUntil = rule.validUntil ? Temporal.PlainDate.from(rule.validUntil) : null;
    for (
      let date = from;
      Temporal.PlainDate.compare(date, through) <= 0;
      date = date.add({ days: 1 })
    ) {
      if (
        date.dayOfWeek !== rule.weekday ||
        Temporal.PlainDate.compare(date, validFrom) < 0 ||
        (validUntil && Temporal.PlainDate.compare(date, validUntil) > 0)
      ) {
        continue;
      }
      const localDate = date.toString();
      const key = sessionKey(rule.id, localDate);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      sessions.push({
        exercises: cloneExercises(rule.template.exercises),
        id: input.idFor(key),
        plannedInstant: localDateTimeToInstant(localDate, rule.localTime, rule.timeZone),
        plannedLocalDate: localDate,
        scheduleRuleId: rule.id,
        source: 'scheduled',
        status: 'planned',
        suggestedLocalTime: rule.localTime,
        templateId: rule.template.id,
        templateNameSnapshot: rule.template.name,
        timeZone: rule.timeZone,
        type: rule.template.type,
      });
    }
  }

  return sessions.sort(
    (left, right) =>
      left.plannedLocalDate.localeCompare(right.plannedLocalDate) ||
      (left.suggestedLocalTime ?? '').localeCompare(right.suggestedLocalTime ?? '') ||
      left.id.localeCompare(right.id),
  );
}
