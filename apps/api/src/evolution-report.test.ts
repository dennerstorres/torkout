import type { DataExport } from '@torkout/contracts';
import { describe, expect, it } from 'vitest';

import { buildEvolutionReport } from './evolution-report.js';

function exportData(): DataExport {
  return {
    account: {
      createdAt: '2026-07-01T10:00:00.000Z',
      email: 'pessoa@example.invalid',
      emailVerified: true,
      id: '60000000-0000-4000-8000-000000000001',
      name: 'Pessoa',
      updatedAt: '2026-07-01T10:00:00.000Z',
    },
    entities: {
      bodyMeasurements: [
        { id: 'm1', localDate: '2026-07-01', weightKg: '70.00', waistCm: '82.00' },
        { id: 'm2', localDate: '2026-07-15', weightKg: '69.00', waistCm: '80.00' },
      ],
      exercises: [],
      exerciseSets: [
        {
          actualRepetitions: 10,
          completed: true,
          id: 'set-1',
          plannedRepetitions: 8,
          sessionExerciseId: 'exercise-1',
          setNumber: 1,
        },
      ],
      habitDefinitions: [
        { id: 'habit-rpe', name: 'RPE', type: 'scale', unit: '0-10' },
        { id: 'habit-whey', name: 'Tolerância ao whey', type: 'choice' },
        { id: 'habit-food', name: 'Proteína no almoço', type: 'boolean' },
      ],
      habitEntries: [
        { habitDefinitionId: 'habit-rpe', localDate: '2026-07-10', numericValue: '7' },
        {
          habitDefinitionId: 'habit-whey',
          localDate: '2026-07-10',
          selectedOptionId: 'option-good',
        },
        { booleanValue: true, habitDefinitionId: 'habit-food', localDate: '2026-07-10' },
      ],
      habitOptions: [{ id: 'option-good', label: 'Boa' }],
      painReports: [
        {
          bodyRegion: 'thigh',
          exerciseStopped: false,
          intensity: 'light',
          localDate: '2026-07-11',
          moment: 'next_day',
          type: 'muscular',
        },
        {
          bodyRegion: 'knee',
          exerciseStopped: true,
          intensity: 'moderate',
          localDate: '2026-07-12',
          moment: 'during',
          type: 'joint',
        },
        {
          bodyRegion: 'knee',
          exerciseStopped: true,
          intensity: 'moderate',
          localDate: '2026-07-13',
          moment: 'during',
          type: 'joint',
        },
      ],
      privacyAcceptances: [],
      progressionDecisions: [],
      progressionEvaluations: [],
      progressionRuleVersions: [],
      progressionSuggestions: [],
      scheduleRules: [],
      sessionExercises: [
        {
          exerciseNameSnapshot: 'Flexão',
          id: 'exercise-1',
          sessionId: 'session-strength',
          status: 'completed',
          trackingMetricSnapshot: 'repetitions',
        },
      ],
      trainingPlans: [],
      userProfiles: [
        { heightCm: '170.00', preferredWorkoutTime: '07:00:00', unitSystem: 'metric' },
      ],
      walkingDetails: [
        {
          actualDistanceMeters: '2500.00',
          durationSeconds: 1800,
          sessionId: 'session-walk',
        },
      ],
      workoutSessions: [
        {
          id: 'session-strength',
          plannedLocalDate: '2026-07-10',
          status: 'completed',
          templateNameSnapshot: 'Treino A',
          type: 'strength',
        },
        {
          id: 'session-walk',
          plannedLocalDate: '2026-07-14',
          status: 'completed',
          templateNameSnapshot: 'Caminhada',
          type: 'walk',
        },
      ],
      workoutTemplateExercises: [],
      workoutTemplates: [],
      workoutTemplateSets: [],
    },
    exportedAt: '2026-07-16T16:00:00.000Z',
    formatVersion: '1.0.0',
    pendingChanges: [],
    timeZone: 'America/Cuiaba',
    units: { distance: 'meter', height: 'centimeter', waist: 'centimeter', weight: 'kilogram' },
  };
}

describe('evolution Markdown report', () => {
  it('summarizes recorded evolution while keeping muscular and joint pain separate', () => {
    const report = buildEvolutionReport(exportData());

    expect(report).toContain('- Período coberto: 2026-07-01 a 2026-07-15');
    expect(report).toContain('- Aderência equivalente: 100%');
    expect(report).toContain('| 2026-07-10 | Treino A | Flexão | completed | 1 |');
    expect(report).toContain('| 2026-07-14 | completed | não registrado | 2500 m | 1800 s |');
    expect(report).toContain('70 kg em 2026-07-01 → 69 kg em 2026-07-15');
    expect(report).toMatch(/## Dor muscular[\s\S]*2026-07-11[\s\S]*## Dor articular/);
    expect(report).toMatch(
      /## Dor articular[\s\S]*2026-07-12[\s\S]*Dor articular recorrente em knee: 2 registros/,
    );
    expect(report).toMatch(/## Esforço percebido[\s\S]*\| 2026-07-10 \| RPE \| 7 \| 0-10 \|/);
    expect(report).toMatch(/## Consumo e tolerância ao whey[\s\S]*Tolerância ao whey \| Boa/);
    expect(report).toMatch(/## Progressão de flexões e agachamentos[\s\S]*Flexão \| 10/);
  });

  it('marks absent information and incorporates supported pending local records', () => {
    const data = exportData();
    data.entities.bodyMeasurements = [];
    data.entities.workoutSessions = [];
    data.entities.sessionExercises = [];
    data.entities.exerciseSets = [];
    data.entities.walkingDetails = [];
    data.entities.painReports = [];
    data.entities.habitEntries = [];
    data.pendingChanges = [
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-16T15:00:00.000Z',
        entityId: '70000000-0000-4000-8000-000000000001',
        entityType: 'body_measurement',
        operation: 'create',
        origin: 'local_pending',
        payload: {
          localDate: '2026-07-16',
          measuredAt: '2026-07-16T15:00:00.000Z',
          weightKg: 68,
        },
      },
    ];

    const report = buildEvolutionReport(data);
    expect(report).toContain('- Período coberto: 2026-07-16 a 2026-07-16');
    expect(report).toContain('- Alterações locais pendentes incorporadas: 1');
    expect(report).toContain('68 kg em 2026-07-16; tendência: não registrado');
    expect(report).toContain('- Aderência equivalente: não registrado');
  });
});
