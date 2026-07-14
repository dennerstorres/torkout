import { describe, expect, it } from 'vitest';

import {
  canonicalProgressionEvidence,
  evaluateProgression,
  type ProgressionSessionEvidence,
} from './progression.js';

const parameters = { maximumRepetitions: 20, minimumPainFreeSessions: 2, minimumRepetitions: 1 };
function session(overrides: Partial<ProgressionSessionEvidence> = {}): ProgressionSessionEvidence {
  return {
    exerciseId: 'exercise',
    exerciseName: 'Flexão',
    jointPainStatus: 'none',
    localDate: '2026-07-14',
    pains: [],
    sessionExerciseId: 'session-exercise',
    sessionId: 'session',
    status: 'completed',
    sets: [{ actualRepetitions: 10, plannedRepetitions: 10, setNumber: 1 }],
    ...overrides,
  };
}

describe('explainable progression engine', () => {
  it('suggests one repetition after two explicitly pain-free eligible sessions', () => {
    const result = evaluateProgression(
      [session({ localDate: '2026-07-12' }), session()],
      parameters,
    );
    expect(result).toMatchObject({
      outcome: 'eligible',
      proposal: { toRepetitions: [11] },
      suggestionType: 'increase',
    });
  });
  it.each(['light', 'moderate', 'strong'] as const)(
    'handles %s muscular pain conservatively',
    (intensity) => {
      const result = evaluateProgression(
        [
          session({
            pains: [
              { bodyRegion: 'arm', intensity, moment: 'after', reportId: 'pain', type: 'muscular' },
            ],
          }),
        ],
        parameters,
      );
      expect(result.suggestionType).toBe(
        intensity === 'light' ? 'maintain' : intensity === 'moderate' ? 'reduce' : 'stop',
      );
    },
  );
  it('blocks an increase when pain data is absent', () => {
    expect(
      evaluateProgression([session({ jointPainStatus: 'unknown' }), session()], parameters).outcome,
    ).toBe('no_change');
  });
  it('stops squats for joint pain in the foot during exercise', () => {
    const result = evaluateProgression(
      [
        session({
          exerciseName: 'Agachamento livre',
          pains: [
            {
              bodyRegion: 'foot',
              intensity: 'light',
              moment: 'during',
              reportId: 'pain',
              type: 'joint',
            },
          ],
        }),
      ],
      parameters,
    );
    expect(result).toMatchObject({ outcome: 'blocked', suggestionType: 'stop' });
  });
  it('never exceeds configured limits and produces stable evidence', () => {
    const evidence = [
      session({ sets: [{ actualRepetitions: 20, plannedRepetitions: 20, setNumber: 1 }] }),
      session({
        localDate: '2026-07-13',
        sets: [{ actualRepetitions: 20, plannedRepetitions: 20, setNumber: 1 }],
      }),
    ];
    expect(evaluateProgression(evidence, parameters).suggestionType).toBe('maintain');
    expect(canonicalProgressionEvidence(evidence)).toBe(canonicalProgressionEvidence(evidence));
  });

  it('keeps generated repetition targets within configurable non-negative bounds', () => {
    for (let target = 1; target <= 50; target += 1) {
      const bounded = { ...parameters, maximumRepetitions: 20, minimumRepetitions: 3 };
      const result = evaluateProgression(
        [
          session({
            localDate: '2026-07-12',
            sets: [{ actualRepetitions: target, plannedRepetitions: target, setNumber: 1 }],
          }),
          session({
            sets: [{ actualRepetitions: target, plannedRepetitions: target, setNumber: 1 }],
          }),
        ],
        bounded,
      );
      expect(
        result.proposal.toRepetitions?.every((value) => value >= 0 && value <= 20) ?? true,
      ).toBe(true);
    }
  });
});
