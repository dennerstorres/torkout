import { describe, expect, it } from 'vitest';

import { calculateWorkoutCompletion } from './daily.js';

describe('daily workout completion', () => {
  it('keeps a session partial when a set is unfinished or an exercise is skipped', () => {
    expect(
      calculateWorkoutCompletion([
        { sets: [{ completed: true }, { completed: false }], status: 'completed' },
      ]),
    ).toBe('partial');
    expect(
      calculateWorkoutCompletion([
        { sets: [{ completed: true }], status: 'completed' },
        { sets: [], status: 'skipped' },
      ]),
    ).toBe('partial');
  });

  it('marks the session complete only when every exercise and set is complete', () => {
    expect(
      calculateWorkoutCompletion([
        { sets: [{ completed: true }, { completed: true }], status: 'completed' },
      ]),
    ).toBe('completed');
  });
});
