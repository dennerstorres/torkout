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
        {
          abdomenCm: '90.00',
          fasting: true,
          id: 'm1',
          localDate: '2026-07-01',
          measuredAt: '2026-07-01T09:00:00.000Z',
          waistCm: '82.00',
          weightKg: '70.00',
        },
        {
          abdomenCm: '88.50',
          id: 'm2',
          localDate: '2026-07-15',
          measuredAt: '2026-07-15T09:00:00.000Z',
          waistCm: '80.00',
          weightKg: '69.00',
        },
      ],
      coffeeIntakes: [
        { id: 'c1', localDate: '2026-07-10', status: 'without_sugar' },
        { id: 'c2', localDate: '2026-07-11', status: 'with_sugar' },
        { id: 'c3', localDate: '2026-07-12', status: 'not_consumed' },
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
      habitDefinitions: [{ id: 'habit-food', name: 'Proteína no almoço', type: 'boolean' }],
      habitEntries: [
        { booleanValue: true, habitDefinitionId: 'habit-food', localDate: '2026-07-10' },
      ],
      habitOptions: [],
      painReports: [
        {
          bodyRegion: 'thigh',
          exerciseStopped: false,
          intensity: 'light',
          intensityScore: 3,
          localDate: '2026-07-11',
          moment: 'next_day',
          type: 'muscular',
        },
        {
          bodyRegion: 'knee',
          exerciseStopped: true,
          intensity: 'moderate',
          intensityScore: 8,
          localDate: '2026-07-12',
          moment: 'during',
          supportDifficulty: true,
          swelling: true,
          type: 'joint',
        },
      ],
      privacyAcceptances: [],
      progressPhotos: [
        {
          byteSize: 120_000,
          contentType: 'image/jpeg',
          id: 'photo-1',
          localDate: '2026-07-10',
          pose: 'front',
          storageKey: 'users/60000000-0000-4000-8000-000000000001/progress-photos/photo-1.jpg',
        },
      ],
      progressionDecisions: [],
      progressionEvaluations: [],
      progressionRuleVersions: [],
      progressionSuggestions: [],
      scheduleRules: [
        {
          id: 'rule-strength',
          localTime: '18:30:00',
          templateId: 'template-strength',
          timeZone: 'America/Cuiaba',
          weekday: 1,
        },
      ],
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
        {
          goal: 'Recomposição corporal',
          heightCm: '170.00',
          preferredWorkoutTime: '18:30:00',
          unitSystem: 'metric',
        },
      ],
      walkingDetails: [
        { actualDistanceMeters: '5000.00', durationSeconds: 3000, sessionId: 'session-walk' },
      ],
      wheyIntakes: [
        {
          consumed: true,
          id: 'whey-1',
          liquidMl: '300.00',
          localDate: '2026-07-10',
          localTime: '19:30:00',
          mixedWith: 'skimmed_milk',
          moment: 'post_workout',
          powderGrams: '30.00',
          tolerance: ['none'],
        },
      ],
      workoutSessions: [
        {
          id: 'session-strength',
          perceivedExertion: 7,
          plannedLocalDate: '2026-07-10',
          recoveryStatus: 'none',
          retroactivelyLoggedAt: '2026-07-12T22:00:00.000Z',
          status: 'completed',
          suggestedLocalTime: '18:30:00',
          templateNameSnapshot: 'Treino A',
          type: 'strength',
        },
        {
          id: 'session-missed',
          plannedLocalDate: '2026-07-13',
          status: 'missed',
          suggestedLocalTime: '18:30:00',
          templateNameSnapshot: 'Treino A',
          type: 'strength',
        },
        {
          id: 'session-future',
          plannedLocalDate: '2026-07-27',
          status: 'planned',
          suggestedLocalTime: '18:30:00',
          templateNameSnapshot: 'Treino A',
          type: 'strength',
        },
        {
          id: 'session-walk',
          perceivedExertion: 4,
          plannedLocalDate: '2026-07-14',
          recoveryStatus: 'none',
          status: 'completed',
          templateNameSnapshot: 'Caminhada',
          type: 'walk',
        },
      ],
      workoutTemplateExercises: [],
      workoutTemplates: [{ id: 'template-strength', name: 'Treino A', type: 'strength' }],
      workoutTemplateSets: [],
    },
    exportedAt: '2026-07-16T16:00:00.000Z',
    formatVersion: '1.0.0',
    pendingChanges: [],
    requestedRange: { from: '2026-07-01', through: '2026-07-31' },
    timeZone: 'America/Cuiaba',
    units: { distance: 'meter', height: 'centimeter', waist: 'centimeter', weight: 'kilogram' },
  };
}

describe('evolution Markdown report', () => {
  it('reports the requested period and the period actually evaluated', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toContain('- Data de geração: 2026-07-16');
    expect(report).toContain('- Período solicitado: 2026-07-01 a 2026-07-31');
    expect(report).toContain('- Período efetivamente avaliado: 2026-07-01 a 2026-07-16');
  });

  it('never counts a future session as missed in the adherence denominator', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Aderência de força[\s\S]*- Aderência: 50%/);
    expect(report).toMatch(/## Aderência de força[\s\S]*- Sessões vencidas: 2\b/);
    expect(report).toMatch(/## Aderência de força[\s\S]*- Perdidas: 1\b/);
    expect(report).toMatch(/## Aderência de força[\s\S]*- Futuras \(fora do denominador\): 1\b/);
  });

  it('keeps strength and walking adherence in separate sections', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Aderência de caminhada[\s\S]*- Aderência: 100%/);
    expect(report).toContain('## Aderência geral');
  });

  it('states the real coffee state without confusing "sem açúcar" with "não consumi"', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Café[\s\S]*\| 2026-07-10 \| Sem açúcar \|/);
    expect(report).toMatch(/## Café[\s\S]*\| 2026-07-11 \| Com açúcar \|/);
    expect(report).toMatch(/## Café[\s\S]*\| 2026-07-12 \| Não consumi \|/);
    expect(report).toMatch(/## Café[\s\S]*Dias sem açúcar: 1\b/);
    expect(report).toMatch(/## Café[\s\S]*Dias sem registro de café no período: /);
  });

  it('reports whey consumption and tolerance from the structured record', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Whey[\s\S]*\| 2026-07-10 \| 19:30 \| sim \| 30 g \|/);
    expect(report).toMatch(/## Whey[\s\S]*Leite desnatado/);
    expect(report).toMatch(/## Whey[\s\S]*Sem desconforto/);
  });

  it('separates explicit "no pain" answers from missing records', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Registros explícitos sem dor[\s\S]*2026-07-10/);
    expect(report).toContain('- Treinos com resposta explícita "sem dor": 2');
    expect(report).toContain('- Treinos sem resposta registrada: 2');
  });

  it('separates muscular and joint pain and shows the new detail fields', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Dor muscular[\s\S]*2026-07-11[\s\S]*## Dor articular/);
    expect(report).toMatch(/## Dor articular[\s\S]*\| 2026-07-12 \| Joelho \| 8 \|/);
    expect(report).toMatch(/## Dor articular[\s\S]*merece atenção/i);
  });

  it('reports perceived exertion', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Esforço percebido[\s\S]*\| 2026-07-10 \| Treino A \| 7 \|/);
    expect(report).toMatch(/## Esforço percebido[\s\S]*Média: 5,5/);
  });

  it('separates waist, abdomen and weight', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toContain('- Peso: 70 kg em 2026-07-01 → 69 kg em 2026-07-15');
    expect(report).toContain('- Cintura: 82 cm em 2026-07-01 → 80 cm em 2026-07-15');
    expect(report).toContain('- Barriga: 90 cm em 2026-07-01 → 88.5 cm em 2026-07-15');
  });

  it('reports the current routine derived from the schedule', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Rotina atual[\s\S]*Segunda-feira \| 18:30 \| Treino A/);
  });

  it('reports the declared goal', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toContain('- Objetivo declarado: Recomposição corporal');
  });

  it('reports levels and progression', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Níveis[\s\S]*Nível atual: Iniciante I/);
    expect(report).toMatch(/## Progressão[\s\S]*Flexão/);
  });

  it('lists photo metadata and never a storage key or URL', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toMatch(/## Fotos de evolução[\s\S]*\| 2026-07-10 \| Frente \|/);
    expect(report).not.toContain('progress-photos/photo-1.jpg');
    expect(report).not.toMatch(/https?:\/\//);
  });

  it('lists the priority missing data and the questions for external review', () => {
    const report = buildEvolutionReport(exportData());
    expect(report).toContain('## Dados ausentes prioritários');
    expect(report).toContain('## Perguntas para revisão externa');
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
    data.entities.coffeeIntakes = [];
    data.entities.wheyIntakes = [];
    data.entities.progressPhotos = [];
    data.entities.scheduleRules = [];
    data.pendingChanges = [
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-16T15:00:00.000Z',
        entityId: '70000000-0000-4000-8000-000000000001',
        entityType: 'body_measurement',
        operation: 'create',
        origin: 'local_pending',
        payload: { localDate: '2026-07-16', measuredAt: '2026-07-16T15:00:00.000Z', weightKg: 68 },
      },
    ];

    const report = buildEvolutionReport(data);
    expect(report).toContain('- Alterações locais pendentes incorporadas: 1');
    expect(report).toContain('68 kg em 2026-07-16; tendência: não registrado');
    expect(report).toMatch(/## Aderência de força[\s\S]*- Aderência: não registrado/);
    expect(report).toMatch(/## Café[\s\S]*não registrado/);
    expect(report).toMatch(/## Rotina atual[\s\S]*não registrado/);
  });

  it('incorporates a pending coffee record without inventing a state', () => {
    const data = exportData();
    data.entities.coffeeIntakes = [];
    data.pendingChanges = [
      {
        baseVersion: null,
        clientOccurredAt: '2026-07-16T15:00:00.000Z',
        entityId: '70000000-0000-4000-8000-000000000002',
        entityType: 'coffee_intake',
        operation: 'create',
        origin: 'local_pending',
        payload: { localDate: '2026-07-16', status: 'without_sugar' },
      },
    ];
    const report = buildEvolutionReport(data);
    expect(report).toMatch(/## Café[\s\S]*\| 2026-07-16 \| Sem açúcar \|/);
  });

  it('distinguishes a completion logged after the fact from one recorded on the day', () => {
    const report = buildEvolutionReport(exportData());
    // A sessão de força foi lançada dois dias depois; a caminhada foi registrada no dia.
    expect(report).toMatch(/1 de 2 conclusões .*lançada.* depois da data/i);
    expect(report).toMatch(/\| 2026-07-10 \|[^|\n]*\|[^|\n]*\| sim \|/);
    expect(report).toMatch(/\| 2026-07-14 \|[^|\n]*\|[^|\n]*\| não \|/);
  });

  it('does not claim retroactive logging when nothing was logged after the fact', () => {
    const data = exportData();
    for (const session of data.entities.workoutSessions) {
      delete (session as Record<string, unknown>).retroactivelyLoggedAt;
    }
    const report = buildEvolutionReport(data);
    expect(report).toMatch(/Nenhuma conclusão .*lançada.* depois da data/i);
  });
});
