import { describe, expect, it } from 'vitest';

import { countRetroactiveCompletions, decideRetroactiveLog } from './retroactive.js';

const timeZone = 'America/Cuiaba';
// 2026-07-31 às 19:00 em Cuiabá (UTC-4).
const now = '2026-07-31T23:00:00Z';

describe('decideRetroactiveLog', () => {
  it('recusa data local futura', () => {
    const decision = decideRetroactiveLog({
      loggedAt: now,
      plannedLocalDate: '2026-08-01',
      timeZone,
    });
    expect(decision).toEqual({ allowed: false, reason: 'future_date' });
  });

  it('aceita data local passada e grava o instante do lançamento', () => {
    const decision = decideRetroactiveLog({
      loggedAt: now,
      plannedLocalDate: '2026-07-29',
      timeZone,
    });
    expect(decision).toEqual({ allowed: true, retroactivelyLoggedAt: now });
  });

  it('registro feito no próprio dia não é retroativo', () => {
    const decision = decideRetroactiveLog({
      loggedAt: now,
      plannedLocalDate: '2026-07-31',
      timeZone,
    });
    expect(decision).toEqual({ allowed: true, retroactivelyLoggedAt: null });
  });

  it('preserva a marca já gravada em vez de sobrescrever com o lançamento novo', () => {
    const decision = decideRetroactiveLog({
      alreadyLoggedAt: '2026-07-30T12:00:00Z',
      loggedAt: now,
      plannedLocalDate: '2026-07-29',
      timeZone,
    });
    expect(decision).toEqual({ allowed: true, retroactivelyLoggedAt: '2026-07-30T12:00:00Z' });
  });

  it('a marca nunca é removida por uma correção feita no mesmo dia da sessão', () => {
    const decision = decideRetroactiveLog({
      alreadyLoggedAt: '2026-07-30T12:00:00Z',
      loggedAt: now,
      plannedLocalDate: '2026-07-31',
      timeZone,
    });
    expect(decision).toEqual({ allowed: true, retroactivelyLoggedAt: '2026-07-30T12:00:00Z' });
  });

  it('usa o fuso do titular para decidir o que é futuro, não UTC', () => {
    // 2026-08-01T02:00:00Z ainda é 2026-07-31 em Cuiabá.
    const decision = decideRetroactiveLog({
      loggedAt: '2026-08-01T02:00:00Z',
      plannedLocalDate: '2026-07-31',
      timeZone,
    });
    expect(decision).toEqual({ allowed: true, retroactivelyLoggedAt: null });
  });
});

describe('countRetroactiveCompletions', () => {
  it('conta apenas conclusões que foram lançadas depois da data', () => {
    expect(
      countRetroactiveCompletions([
        { retroactivelyLoggedAt: '2026-07-31T23:00:00Z', status: 'completed' },
        { retroactivelyLoggedAt: '2026-07-31T23:00:00Z', status: 'partial' },
        { retroactivelyLoggedAt: null, status: 'completed' },
        { status: 'completed' },
        { retroactivelyLoggedAt: '2026-07-31T23:00:00Z', status: 'missed' },
        { retroactivelyLoggedAt: '2026-07-31T23:00:00Z', status: 'planned' },
      ]),
    ).toBe(2);
  });

  it('devolve zero quando nada foi lançado depois', () => {
    expect(countRetroactiveCompletions([{ status: 'completed' }])).toBe(0);
    expect(countRetroactiveCompletions([])).toBe(0);
  });
});
