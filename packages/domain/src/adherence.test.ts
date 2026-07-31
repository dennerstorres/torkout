import { describe, expect, it } from 'vitest';

import { calculateAdherence, type AdherenceSessionInput } from './adherence.js';

const timeZone = 'America/Cuiaba';

function session(input: Partial<AdherenceSessionInput> = {}): AdherenceSessionInput {
  return {
    localDate: '2026-07-06',
    plannedLocalTime: '18:30',
    status: 'completed',
    type: 'strength',
    ...input,
  };
}

describe('calculateAdherence', () => {
  it('keeps sessions planned for the future out of the denominator', () => {
    const result = calculateAdherence({
      from: '2026-07-01',
      now: '2026-07-08T12:00:00-04:00',
      sessions: [
        session({ localDate: '2026-07-06', status: 'completed' }),
        session({ localDate: '2026-07-10', status: 'planned' }),
        session({ localDate: '2026-07-13', status: 'planned' }),
      ],
      through: '2026-07-31',
      timeZone,
    });

    expect(result.strength.due).toBe(1);
    expect(result.strength.denominator).toBe(1);
    expect(result.strength.future).toBe(2);
    expect(result.strength.percentage).toBe(100);
    expect(result.evaluatedThrough).toBe('2026-07-08');
  });

  it('only counts a session as due after its planned time plus the grace window', () => {
    const beforeDeadline = calculateAdherence({
      from: '2026-07-06',
      now: '2026-07-06T18:00:00-04:00',
      sessions: [session({ status: 'planned' })],
      through: '2026-07-06',
      timeZone,
    });
    expect(beforeDeadline.strength.due).toBe(0);
    expect(beforeDeadline.strength.percentage).toBeNull();

    const afterDeadline = calculateAdherence({
      from: '2026-07-06',
      now: '2026-07-06T23:59:00-04:00',
      sessions: [session({ status: 'planned' })],
      through: '2026-07-06',
      timeZone,
    });
    expect(afterDeadline.strength.due).toBe(1);
    expect(afterDeadline.strength.denominator).toBe(1);
    expect(afterDeadline.strength.overdue).toBe(1);
    expect(afterDeadline.strength.percentage).toBe(0);
  });

  it('uses the end of the local day when no time was planned', () => {
    const result = calculateAdherence({
      from: '2026-07-06',
      now: '2026-07-06T20:00:00-04:00',
      sessions: [session({ plannedLocalTime: null, status: 'planned' })],
      through: '2026-07-06',
      timeZone,
    });
    expect(result.strength.due).toBe(0);
    expect(result.strength.future).toBe(1);
  });

  it('scores completed as one and partial as one half', () => {
    const result = calculateAdherence({
      from: '2026-07-01',
      now: '2026-07-31T23:00:00-04:00',
      sessions: [
        session({ localDate: '2026-07-06', status: 'completed' }),
        session({ localDate: '2026-07-08', status: 'partial' }),
        session({ localDate: '2026-07-10', status: 'missed' }),
        session({ localDate: '2026-07-13', status: 'missed' }),
      ],
      through: '2026-07-31',
      timeZone,
    });
    expect(result.strength.score).toBe(1.5);
    expect(result.strength.denominator).toBe(4);
    expect(result.strength.percentage).toBe(37.5);
    expect(result.strength.completed).toBe(1);
    expect(result.strength.partial).toBe(1);
    expect(result.strength.missed).toBe(2);
  });

  it('excludes justified cancellations from the denominator and keeps unjustified ones', () => {
    const result = calculateAdherence({
      from: '2026-07-01',
      now: '2026-07-31T23:00:00-04:00',
      sessions: [
        session({ localDate: '2026-07-06', status: 'completed' }),
        session({ localDate: '2026-07-08', status: 'cancelled' }),
        session({ cancellationJustified: false, localDate: '2026-07-10', status: 'cancelled' }),
      ],
      through: '2026-07-31',
      timeZone,
    });
    expect(result.strength.cancelled).toBe(2);
    expect(result.strength.due).toBe(3);
    expect(result.strength.denominator).toBe(2);
    expect(result.strength.percentage).toBe(50);
  });

  it('reports strength and walking separately and combines them in the general indicator', () => {
    const result = calculateAdherence({
      from: '2026-07-01',
      now: '2026-07-31T23:00:00-04:00',
      sessions: [
        session({ localDate: '2026-07-06', status: 'completed', type: 'strength' }),
        session({ localDate: '2026-07-08', status: 'missed', type: 'strength' }),
        session({ localDate: '2026-07-06', status: 'completed', type: 'walk' }),
        session({ localDate: '2026-07-10', status: 'completed', type: 'walk' }),
        session({ localDate: '2026-07-11', status: 'planned', type: 'rest' }),
      ],
      through: '2026-07-31',
      timeZone,
    });
    expect(result.strength.percentage).toBe(50);
    expect(result.walk.percentage).toBe(100);
    expect(result.general.denominator).toBe(4);
    expect(result.general.percentage).toBe(75);
  });

  it('counts an unfinished session as due only after the deadline', () => {
    const result = calculateAdherence({
      from: '2026-07-06',
      now: '2026-07-06T19:00:00-04:00',
      sessions: [session({ status: 'in_progress' })],
      through: '2026-07-06',
      timeZone,
    });
    expect(result.strength.due).toBe(1);
    expect(result.strength.overdue).toBe(1);
    expect(result.strength.percentage).toBe(0);
  });

  it('ignores sessions outside the requested period', () => {
    const result = calculateAdherence({
      from: '2026-07-01',
      now: '2026-07-31T23:00:00-04:00',
      sessions: [
        session({ localDate: '2026-06-29', status: 'missed' }),
        session({ localDate: '2026-08-03', status: 'missed' }),
        session({ localDate: '2026-07-06', status: 'completed' }),
      ],
      through: '2026-07-31',
      timeZone,
    });
    expect(result.strength.due).toBe(1);
    expect(result.strength.percentage).toBe(100);
  });

  it('never evaluates beyond the current local date of the user', () => {
    const result = calculateAdherence({
      from: '2026-07-01',
      now: '2026-07-09T02:30:00+00:00',
      sessions: [],
      through: '2026-12-31',
      timeZone,
    });
    // 2026-07-09T02:30Z is still 2026-07-08 in America/Cuiaba (UTC-4).
    expect(result.evaluatedThrough).toBe('2026-07-08');
    expect(result.evaluatedFrom).toBe('2026-07-01');
  });
});
