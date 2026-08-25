import type { DataExport } from '@torkout/contracts';
import { describe, expect, it } from 'vitest';

import {
  comparePeriods,
  getExerciseProgress,
  getLastWorkout,
  getMeasurementSummary,
  getMeasurements,
  getNutrition,
  getWheyHistory,
  getProfile,
  getProgress,
  getRecovery,
  getTrainingSummary,
  getWalks,
  getWorkouts,
  type QueryContext,
} from './queries.js';
import { resolvePeriod } from './period.js';

const TIME_ZONE = 'America/Cuiaba';
const NOW = new Date('2026-08-06T14:00:00Z');

type Row = Record<string, unknown>;

function emptyEntities(): DataExport['entities'] {
  return {
    bodyMeasurements: [],
    coffeeIntakes: [],
    exercises: [],
    exerciseSets: [],
    habitDefinitions: [],
    habitEntries: [],
    habitOptions: [],
    painReports: [],
    privacyAcceptances: [],
    progressPhotos: [],
    progressionDecisions: [],
    progressionEvaluations: [],
    progressionRuleVersions: [],
    progressionSuggestions: [],
    scheduleRules: [],
    sessionExercises: [],
    trainingPlans: [],
    userProfiles: [],
    walkingDetails: [],
    wheyIntakes: [],
    workoutSessions: [],
    workoutTemplateExercises: [],
    workoutTemplates: [],
    workoutTemplateSets: [],
  } as unknown as DataExport['entities'];
}

function snapshot(entities: Partial<DataExport['entities']>): DataExport {
  return {
    account: {
      createdAt: '2026-01-05T10:00:00.000Z',
      email: 'titular@example.test',
      emailVerified: true,
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Titular',
      updatedAt: '2026-08-01T10:00:00.000Z',
    },
    entities: { ...emptyEntities(), ...entities },
    exportedAt: NOW.toISOString(),
    formatVersion: 1,
    pendingChanges: [],
    requestedRange: null,
    timeZone: TIME_ZONE,
    units: {
      distance: 'meter',
      height: 'centimeter',
      waist: 'centimeter',
      weight: 'kilogram',
    },
  } as unknown as DataExport;
}

function context(entities: Partial<DataExport['entities']>, days = 14): QueryContext {
  const data = snapshot(entities);
  return { now: NOW, period: resolvePeriod({ days }, TIME_ZONE, NOW), snapshot: data };
}

function session(overrides: Row): Row {
  return {
    deletedAt: null,
    id: `session-${String(overrides.plannedLocalDate)}-${String(overrides.type ?? 'strength')}`,
    notes: null,
    perceivedExertion: null,
    plannedLocalDate: '2026-08-01',
    recoveryStatus: 'not_answered',
    retroactivelyLoggedAt: null,
    source: 'scheduled',
    status: 'completed',
    suggestedLocalTime: '06:30:00',
    templateNameSnapshot: 'Treino A',
    timeZone: TIME_ZONE,
    type: 'strength',
    ...overrides,
  };
}

function exercise(sessionId: string, name: string, overrides: Row = {}): Row {
  return {
    deletedAt: null,
    exerciseNameSnapshot: name,
    id: `${sessionId}-${name}`,
    sessionId,
    sortOrder: 0,
    status: 'completed',
    trackingMetricSnapshot: 'repetitions',
    ...overrides,
  };
}

function set(sessionExerciseId: string, setNumber: number, actual: number | null): Row {
  return {
    actualRepetitions: actual,
    completed: actual !== null,
    deletedAt: null,
    id: `${sessionExerciseId}-${setNumber}`,
    plannedRepetitions: 10,
    sessionExerciseId,
    setNumber,
  };
}

describe('getProfile', () => {
  it('returns training context without any credential material', () => {
    const result = getProfile(
      context({
        userProfiles: [
          {
            deletedAt: null,
            goal: 'Ganhar consistência',
            heightCm: '178.00',
            id: 'profile-1',
            preferredWorkoutTime: '06:30:00',
            timeZone: TIME_ZONE,
            unitSystem: 'metric',
          },
        ] as never,
      }),
    );

    expect(result.height_cm).toBe(178);
    expect(result.goal).toBe('Ganhar consistência');
    expect(result.preferred_workout_time).toBe('06:30');
    expect(result.time_zone).toBe(TIME_ZONE);
    expect(result.started_at).toBe('2026-01-05');

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/password|hash|token|secret|session/i);
    expect(serialized).not.toContain('titular@example.test');
  });

  it('reports an absent height as null rather than zero', () => {
    const result = getProfile(
      context({ userProfiles: [{ deletedAt: null, heightCm: null, id: 'p' }] as never }),
    );
    expect(result.height_cm).toBeNull();
  });
});

describe('getTrainingSummary', () => {
  it('keeps a future session out of the adherence denominator', () => {
    const result = getTrainingSummary(
      context({
        workoutSessions: [
          session({ plannedLocalDate: '2026-08-03', status: 'completed' }),
          session({ plannedLocalDate: '2026-08-20', status: 'planned' }),
        ] as never,
      }),
    );

    expect(result.strength.completed).toBe(1);
    expect(result.strength.denominator).toBe(1);
    expect(result.strength.adherence_percent).toBe(100);
  });

  it('counts a partial session as half', () => {
    const result = getTrainingSummary(
      context({
        workoutSessions: [
          session({ plannedLocalDate: '2026-08-03', status: 'completed' }),
          session({ plannedLocalDate: '2026-08-04', status: 'partial' }),
        ] as never,
      }),
    );

    expect(result.strength.denominator).toBe(2);
    expect(result.strength.partial).toBe(1);
    expect(result.strength.adherence_percent).toBe(75);
  });

  it('leaves a cancelled session out of the denominator', () => {
    const result = getTrainingSummary(
      context({
        workoutSessions: [
          session({ plannedLocalDate: '2026-08-03', status: 'completed' }),
          session({ plannedLocalDate: '2026-08-04', status: 'cancelled' }),
        ] as never,
      }),
    );

    expect(result.strength.denominator).toBe(1);
    expect(result.strength.cancelled).toBe(1);
    expect(result.strength.adherence_percent).toBe(100);
  });

  it('separates an explicit absence of pain from a missing answer', () => {
    const result = getTrainingSummary(
      context({
        workoutSessions: [
          session({ plannedLocalDate: '2026-08-01', recoveryStatus: 'none' }),
          session({ plannedLocalDate: '2026-08-02', recoveryStatus: 'not_answered' }),
          session({ plannedLocalDate: '2026-08-03', recoveryStatus: 'reported' }),
        ] as never,
      }),
    );

    expect(result.recovery.sessions_answered_without_pain).toBe(1);
    expect(result.recovery.sessions_without_recovery_answer).toBe(1);
    expect(result.recovery.sessions_with_discomfort_reported).toBe(1);
  });

  it('aggregates sets, repetitions and per exercise totals', () => {
    const result = getTrainingSummary(
      context({
        exerciseSets: [
          set('s1-Flexão', 1, 12),
          set('s1-Flexão', 2, 10),
          set('s1-Agachamento', 1, 20),
        ] as never,
        sessionExercises: [exercise('s1', 'Flexão'), exercise('s1', 'Agachamento')] as never,
        workoutSessions: [session({ id: 's1', plannedLocalDate: '2026-08-03' })] as never,
      }),
    );

    expect(result.totals.sets).toBe(3);
    expect(result.totals.repetitions).toBe(42);
    expect(result.exercises['Flexão']).toMatchObject({
      best_set: 12,
      sessions: 1,
      total_repetitions: 22,
    });
  });
});

describe('getWorkouts', () => {
  it('honours the requested limit', () => {
    const sessions = Array.from({ length: 5 }, (_, index) =>
      session({ id: `s${index}`, plannedLocalDate: `2026-08-0${index + 1}` }),
    );
    const result = getWorkouts(context({ workoutSessions: sessions as never }), { limit: 2 });

    expect(result.workouts).toHaveLength(2);
    expect(result.returned).toBe(2);
    expect(result.total_in_period).toBe(5);
    expect(result.truncated).toBe(true);
  });

  it('filters by status', () => {
    const result = getWorkouts(
      context({
        workoutSessions: [
          session({ id: 'a', plannedLocalDate: '2026-08-01', status: 'completed' }),
          session({ id: 'b', plannedLocalDate: '2026-08-02', status: 'missed' }),
        ] as never,
      }),
      { status: 'missed' },
    );

    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0]?.status).toBe('missed');
  });

  it('filters by exercise name ignoring accents and case', () => {
    const result = getWorkouts(
      context({
        exerciseSets: [set('a-Flexão', 1, 10)] as never,
        sessionExercises: [exercise('a', 'Flexão')] as never,
        workoutSessions: [
          session({ id: 'a', plannedLocalDate: '2026-08-01' }),
          session({ id: 'b', plannedLocalDate: '2026-08-02' }),
        ] as never,
      }),
      { exercise: 'flexao' },
    );

    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0]?.id).toBe('a');
  });
});

describe('getLastWorkout', () => {
  it('returns the most recent concluded session', () => {
    const result = getLastWorkout(
      context({
        workoutSessions: [
          session({ id: 'old', plannedLocalDate: '2026-08-01', status: 'completed' }),
          session({ id: 'new', plannedLocalDate: '2026-08-05', status: 'completed' }),
          session({ id: 'future', plannedLocalDate: '2026-08-12', status: 'planned' }),
        ] as never,
      }),
      {},
    );

    expect(result.workout?.id).toBe('new');
  });

  it('reports the absence explicitly when nothing was concluded', () => {
    const result = getLastWorkout(context({}), {});
    expect(result.workout).toBeNull();
  });
});

describe('getExerciseProgress', () => {
  it('summarises repetitions per session and the overall trend', () => {
    const result = getExerciseProgress(
      context({
        exerciseSets: [
          set('a-Flexão', 1, 10),
          set('a-Flexão', 2, 8),
          set('b-Flexão', 1, 14),
          set('b-Flexão', 2, 12),
        ] as never,
        sessionExercises: [exercise('a', 'Flexão'), exercise('b', 'Flexão')] as never,
        workoutSessions: [
          session({ id: 'a', plannedLocalDate: '2026-08-01' }),
          session({ id: 'b', plannedLocalDate: '2026-08-05' }),
        ] as never,
      }),
      { exercise: 'Flexão' },
    );

    expect(result.sessions).toHaveLength(2);
    expect(result.first?.total).toBe(18);
    expect(result.last?.total).toBe(26);
    expect(result.best_set).toBe(14);
    expect(result.total_volume).toBe(44);
    expect(result.trend).toBe('increasing');
  });

  it('reports an unknown exercise as an empty series rather than an error', () => {
    const result = getExerciseProgress(context({}), { exercise: 'Remada' });
    expect(result.sessions).toEqual([]);
    expect(result.trend).toBe('insufficient_data');
  });
});

describe('getMeasurements', () => {
  it('distinguishes an unrecorded measure from zero', () => {
    const result = getMeasurements(
      context({
        bodyMeasurements: [
          {
            abdomenCm: null,
            additionalMeasurements: [],
            deletedAt: null,
            fasting: true,
            id: 'm1',
            localDate: '2026-08-02',
            measuredAt: '2026-08-02T09:00:00.000Z',
            notes: null,
            waistCm: '88.00',
            weightKg: '82.40',
          },
        ] as never,
      }),
      {},
    );

    expect(result.measurements[0]?.weight_kg).toBe(82.4);
    expect(result.measurements[0]?.waist_cm).toBe(88);
    expect(result.measurements[0]?.abdomen_cm).toBeNull();
    expect(result.measurements[0]?.fasting).toBe(true);
  });
});

describe('getMeasurementSummary', () => {
  it('reports first, last, delta and extremes per measure', () => {
    const result = getMeasurementSummary(
      context({
        bodyMeasurements: [
          {
            deletedAt: null,
            id: 'm1',
            localDate: '2026-08-01',
            measuredAt: '2026-08-01T09:00:00.000Z',
            weightKg: '84.00',
          },
          {
            deletedAt: null,
            id: 'm2',
            localDate: '2026-08-05',
            measuredAt: '2026-08-05T09:00:00.000Z',
            weightKg: '82.00',
          },
        ] as never,
      }),
    );

    expect(result.weight_kg).toMatchObject({
      count: 2,
      delta: -2,
      delta_percent: -2.38,
      first: 84,
      last: 82,
      max: 84,
      min: 82,
    });
    expect(result.waist_cm).toBeNull();
  });
});

describe('getWalks', () => {
  it('summarises distance, duration and status', () => {
    const result = getWalks(
      context({
        walkingDetails: [
          {
            actualDistanceMeters: '3000.00',
            deletedAt: null,
            durationSeconds: 1800,
            id: 'w1',
            notes: null,
            sessionId: 'walk-1',
          },
        ] as never,
        workoutSessions: [
          session({
            id: 'walk-1',
            plannedLocalDate: '2026-08-04',
            status: 'completed',
            type: 'walk',
          }),
        ] as never,
      }),
    );

    expect(result.summary.completed).toBe(1);
    expect(result.summary.total_distance_meters).toBe(3000);
    expect(result.summary.total_duration_seconds).toBe(1800);
    expect(result.summary.average_distance_meters).toBe(3000);
    expect(result.walks[0]?.distance_meters).toBe(3000);
  });
});

describe('getNutrition', () => {
  it('never folds coffee without sugar into coffee not consumed', () => {
    const result = getNutrition(
      context({
        coffeeIntakes: [
          { deletedAt: null, id: 'c1', localDate: '2026-08-01', status: 'without_sugar' },
          { deletedAt: null, id: 'c2', localDate: '2026-08-02', status: 'not_consumed' },
          { deletedAt: null, id: 'c3', localDate: '2026-08-03', status: 'with_sugar' },
        ] as never,
      }),
    );

    expect(result.coffee.without_sugar).toBe(1);
    expect(result.coffee.not_consumed).toBe(1);
    expect(result.coffee.with_sugar).toBe(1);
    expect(result.coffee.days_without_record).toBe(11);
  });
});

describe('getWheyHistory', () => {
  it('distinguishes the ready to drink bottle from the powder shake', () => {
    const result = getWheyHistory(
      context({
        wheyIntakes: [
          {
            blendedWith: null,
            brand: 'YoPro',
            consumed: true,
            deletedAt: null,
            format: 'ready_to_drink',
            id: 'w1',
            localDate: '2026-08-01',
            servingUnit: 'unit',
            servings: '1.00',
            tolerance: [],
          },
          {
            blendedWith: 'Banana e abacate',
            consumed: true,
            deletedAt: null,
            format: 'powder',
            id: 'w2',
            localDate: '2026-08-02',
            mixedWith: 'skimmed_milk',
            powderGrams: '30.00',
            servingUnit: 'tablespoon',
            servings: '2.00',
            tolerance: [],
          },
        ] as never,
      }),
      {},
    );

    expect(result.entries).toEqual([
      expect.objectContaining({
        blended_with: 'Banana e abacate',
        format: 'powder',
        serving_unit: 'tablespoon',
        servings: 2,
      }),
      expect.objectContaining({
        blended_with: null,
        format: 'ready_to_drink',
        powder_grams: null,
        serving_unit: 'unit',
      }),
    ]);
  });

  it('reads a record without a declared format as powder', () => {
    const result = getWheyHistory(
      context({
        wheyIntakes: [
          {
            consumed: true,
            deletedAt: null,
            id: 'w3',
            localDate: '2026-08-01',
            powderGrams: '30.00',
            tolerance: [],
          },
        ] as never,
      }),
      {},
    );

    expect(result.entries[0]).toMatchObject({ format: 'powder', serving_unit: null });
  });
});

describe('getRecovery', () => {
  it('never presents a missing record as an absence of pain', () => {
    const result = getRecovery(
      context({
        workoutSessions: [
          session({ id: 'a', plannedLocalDate: '2026-08-01', recoveryStatus: 'none' }),
          session({ id: 'b', plannedLocalDate: '2026-08-02', recoveryStatus: 'not_answered' }),
        ] as never,
      }),
      {},
    );

    expect(result.answers.explicitly_without_pain).toBe(1);
    expect(result.answers.not_answered).toBe(1);
    expect(result.answers.explicitly_without_pain).not.toBe(2);
    expect(result.notice).toMatch(/ausência de registro/i);
  });

  it('returns the recorded discomfort fields', () => {
    const result = getRecovery(
      context({
        painReports: [
          {
            bodyRegion: 'knee',
            customBodyRegion: null,
            deletedAt: null,
            exerciseStopped: true,
            id: 'p1',
            intensity: 'moderate',
            intensityScore: 6,
            localDate: '2026-08-03',
            moment: 'during',
            notes: null,
            supportDifficulty: false,
            swelling: false,
            type: 'joint',
          },
        ] as never,
      }),
      {},
    );

    expect(result.reports).toHaveLength(1);
    expect(result.reports[0]).toMatchObject({
      body_region: 'knee',
      exercise_stopped: true,
      intensity_score: 6,
      moment: 'during',
      support_difficulty: false,
      swelling: false,
      type: 'joint',
    });
    expect(result.counts.joint).toBe(1);
    expect(result.counts.muscular).toBe(0);
  });
});

describe('getProgress', () => {
  it('consolidates adherence, streaks, level and measures', () => {
    const result = getProgress(
      context({
        bodyMeasurements: [
          {
            deletedAt: null,
            id: 'm1',
            localDate: '2026-08-01',
            measuredAt: '2026-08-01T09:00:00.000Z',
            weightKg: '83.00',
          },
        ] as never,
        workoutSessions: [
          session({ id: 'a', plannedLocalDate: '2026-08-03', status: 'completed' }),
        ] as never,
      }),
    );

    expect(result.workouts.completed).toBe(1);
    expect(result.level.current).toBeTruthy();
    expect(result.streak.current).toBeGreaterThanOrEqual(0);
    expect(result.measurements.weight_kg?.last).toBe(83);
  });
});

describe('comparePeriods', () => {
  it('returns absolute and percentage differences when they are mathematically valid', () => {
    const entities = {
      exerciseSets: [set('a-Flexão', 1, 10), set('b-Flexão', 1, 20)] as never,
      sessionExercises: [exercise('a', 'Flexão'), exercise('b', 'Flexão')] as never,
      workoutSessions: [
        session({ id: 'a', plannedLocalDate: '2026-07-10' }),
        session({ id: 'b', plannedLocalDate: '2026-08-03' }),
      ] as never,
    };
    const data = snapshot(entities);
    const result = comparePeriods({
      current: {
        now: NOW,
        period: resolvePeriod({ from: '2026-08-01', to: '2026-08-06' }, TIME_ZONE, NOW),
        snapshot: data,
      },
      previous: {
        now: NOW,
        period: resolvePeriod({ from: '2026-07-01', to: '2026-07-31' }, TIME_ZONE, NOW),
        snapshot: data,
      },
    });

    expect(result.workouts_completed).toMatchObject({ current: 1, delta: 0, previous: 1 });
    expect(result.exercises['Flexão']).toMatchObject({
      current: 20,
      delta: 10,
      delta_percent: 100,
      previous: 10,
    });
  });

  it('omits a percentage difference when the previous value is zero', () => {
    const data = snapshot({
      workoutSessions: [session({ id: 'b', plannedLocalDate: '2026-08-03' })] as never,
    });
    const result = comparePeriods({
      current: {
        now: NOW,
        period: resolvePeriod({ from: '2026-08-01', to: '2026-08-06' }, TIME_ZONE, NOW),
        snapshot: data,
      },
      previous: {
        now: NOW,
        period: resolvePeriod({ from: '2026-07-01', to: '2026-07-31' }, TIME_ZONE, NOW),
        snapshot: data,
      },
    });

    expect(result.workouts_completed.previous).toBe(0);
    expect(result.workouts_completed.delta_percent).toBeNull();
  });
});

describe('privacy of every query', () => {
  it('never leaks account credentials or internal identifiers', () => {
    const ctx = context({
      userProfiles: [{ deletedAt: null, heightCm: '178.00', id: 'p' }] as never,
      workoutSessions: [session({ id: 'a', plannedLocalDate: '2026-08-03' })] as never,
    });
    const payloads = [
      getProfile(ctx),
      getTrainingSummary(ctx),
      getWorkouts(ctx, {}),
      getLastWorkout(ctx, {}),
      getMeasurements(ctx, {}),
      getMeasurementSummary(ctx),
      getWalks(ctx),
      getNutrition(ctx),
      getRecovery(ctx, {}),
      getProgress(ctx),
    ];

    for (const payload of payloads) {
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toMatch(/"(password|passwordHash|token|secret|cookie|sessionToken)"/i);
      expect(serialized).not.toContain('titular@example.test');
    }
  });
});
