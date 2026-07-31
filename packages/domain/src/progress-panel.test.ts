import { describe, expect, it } from 'vitest';

import { summarizeProgressPanel, type ProgressPanelInput } from './progress-panel.js';

function baseInput(): ProgressPanelInput {
  return {
    from: '2026-07-01',
    measurements: [
      { abdomenCm: 90, localDate: '2026-07-01', waistCm: 84, weightKg: 70 },
      { abdomenCm: 88.5, localDate: '2026-07-22', waistCm: 82.5, weightKg: 71.2 },
    ],
    now: '2026-07-24T18:00:00-04:00',
    painReports: [
      { localDate: '2026-07-02', type: 'muscular' },
      { localDate: '2026-07-02', type: 'joint' },
      { localDate: '2026-07-09', type: 'muscular' },
      { localDate: '2026-07-10', type: 'other' },
    ],
    sessions: [
      {
        exercises: [
          {
            name: 'Flexão de braço',
            metric: 'repetitions',
            sets: [12, 10, 8],
            status: 'completed',
          },
          { name: 'Agachamento livre', metric: 'repetitions', sets: [15, 15], status: 'completed' },
        ],
        localDate: '2026-07-06',
        perceivedExertion: 6,
        recoveryStatus: 'none',
        status: 'completed',
        type: 'strength',
      },
      {
        exercises: [
          { name: 'Flexão de braço', metric: 'repetitions', sets: [14, 11], status: 'completed' },
        ],
        localDate: '2026-07-08',
        perceivedExertion: 8,
        recoveryStatus: 'reported',
        status: 'completed',
        type: 'strength',
      },
      {
        exercises: [],
        localDate: '2026-07-10',
        perceivedExertion: null,
        recoveryStatus: 'not_answered',
        status: 'missed',
        type: 'strength',
      },
      {
        exercises: [],
        localDate: '2026-07-20',
        perceivedExertion: 4,
        recoveryStatus: 'none',
        status: 'completed',
        type: 'walk',
        walkDistanceMeters: 5000,
      },
      {
        exercises: [],
        localDate: '2026-07-24',
        perceivedExertion: 3,
        recoveryStatus: 'none',
        status: 'completed',
        type: 'walk',
        walkDistanceMeters: 5200,
      },
    ],
    through: '2026-07-24',
    timeZone: 'America/Cuiaba',
  };
}

describe('summarizeProgressPanel', () => {
  it('counts concluded sessions, streaks and the current week', () => {
    const panel = summarizeProgressPanel(baseInput());
    expect(panel.concludedSessions).toBe(4);
    expect(panel.currentStreak).toBe(2);
    expect(panel.longestStreak).toBe(2);
    // A semana civil de 2026-07-24 (sexta) começa em 2026-07-20 e contém as duas caminhadas.
    expect(panel.sessionsThisWeek).toBe(2);
    expect(panel.strengthSessionsThisWeek).toBe(0);
  });

  it('totals push-ups and squats per session without mixing them', () => {
    const panel = summarizeProgressPanel(baseInput());
    expect(panel.pushUpsPerSession).toEqual([
      { localDate: '2026-07-06', repetitions: 30 },
      { localDate: '2026-07-08', repetitions: 25 },
    ]);
    expect(panel.squatsPerSession).toEqual([{ localDate: '2026-07-06', repetitions: 30 }]);
  });

  it('reports the best single set', () => {
    const panel = summarizeProgressPanel(baseInput());
    expect(panel.bestSet).toEqual({
      exercise: 'Agachamento livre',
      localDate: '2026-07-06',
      repetitions: 15,
    });
  });

  it('separates weight, waist and abdomen evolution', () => {
    const panel = summarizeProgressPanel(baseInput());
    expect(panel.weight).toEqual({
      first: { localDate: '2026-07-01', value: 70 },
      last: { localDate: '2026-07-22', value: 71.2 },
      delta: 1.2,
    });
    expect(panel.waist?.delta).toBe(-1.5);
    expect(panel.abdomen?.delta).toBe(-1.5);
  });

  it('keeps walks apart from strength adherence', () => {
    const panel = summarizeProgressPanel(baseInput());
    expect(panel.walksConcluded).toBe(2);
    expect(panel.walkDistanceMeters).toBe(10_200);
    expect(panel.adherence.strength.denominator).toBe(3);
    expect(panel.adherence.walk.denominator).toBe(2);
  });

  it('averages perceived exertion only over sessions that recorded it', () => {
    const panel = summarizeProgressPanel(baseInput());
    expect(panel.averagePerceivedExertion).toBe(5.25);
    expect(panel.perceivedExertionSamples).toBe(4);
  });

  it('separates explicit "no pain" answers from pain records by type', () => {
    const panel = summarizeProgressPanel(baseInput());
    expect(panel.sessionsWithoutPain).toBe(3);
    expect(panel.muscularPainReports).toBe(2);
    expect(panel.jointPainReports).toBe(1);
    expect(panel.otherDiscomfortReports).toBe(1);
  });

  it('returns neutral values when nothing was recorded', () => {
    const panel = summarizeProgressPanel({
      from: '2026-07-01',
      measurements: [],
      now: '2026-07-24T18:00:00-04:00',
      painReports: [],
      sessions: [],
      through: '2026-07-24',
      timeZone: 'America/Cuiaba',
    });
    expect(panel.concludedSessions).toBe(0);
    expect(panel.averagePerceivedExertion).toBeNull();
    expect(panel.weight).toBeNull();
    expect(panel.bestSet).toBeNull();
    expect(panel.adherence.general.percentage).toBeNull();
  });
});
