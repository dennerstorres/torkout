import { describe, expect, it } from 'vitest';

import {
  COFFEE_STATUS_VALUES,
  coffeeStatusLabel,
  mapLegacyCoffeeRecord,
  summarizeCoffee,
} from './coffee.js';

describe('coffee status vocabulary', () => {
  it('exposes the three explicit states', () => {
    expect(COFFEE_STATUS_VALUES).toEqual(['not_consumed', 'without_sugar', 'with_sugar']);
    expect(coffeeStatusLabel('not_consumed')).toBe('Não consumi');
    expect(coffeeStatusLabel('without_sugar')).toBe('Sem açúcar');
    expect(coffeeStatusLabel('with_sugar')).toBe('Com açúcar');
  });
});

describe('mapLegacyCoffeeRecord', () => {
  it('maps unambiguous textual answers', () => {
    expect(mapLegacyCoffeeRecord({ habitName: 'Café', textValue: 'sem açúcar' })).toEqual({
      status: 'without_sugar',
      confidence: 'exact',
    });
    expect(mapLegacyCoffeeRecord({ habitName: 'Café', textValue: 'com acucar' })).toEqual({
      status: 'with_sugar',
      confidence: 'exact',
    });
    expect(mapLegacyCoffeeRecord({ habitName: 'Café', textValue: 'não consumi' })).toEqual({
      status: 'not_consumed',
      confidence: 'exact',
    });
  });

  it('maps option labels of legacy choice habits', () => {
    expect(
      mapLegacyCoffeeRecord({ habitName: 'Café da manhã', optionLabel: 'Com açúcar' }),
    ).toEqual({ status: 'with_sugar', confidence: 'exact' });
  });

  it('never turns a coffee-without-sugar habit into "not consumed"', () => {
    const result = mapLegacyCoffeeRecord({
      booleanValue: false,
      habitName: 'Café sem açúcar',
    });
    expect(result.status).toBeNull();
    expect(result.confidence).toBe('ambiguous');
  });

  it('maps an affirmative answer of a "coffee without sugar" habit', () => {
    expect(mapLegacyCoffeeRecord({ booleanValue: true, habitName: 'Café sem açúcar' })).toEqual({
      status: 'without_sugar',
      confidence: 'exact',
    });
  });

  it('treats a plain "Café" boolean as consumption without sugar information', () => {
    expect(mapLegacyCoffeeRecord({ booleanValue: true, habitName: 'Café' })).toEqual({
      status: null,
      confidence: 'consumed_unknown_sugar',
    });
    expect(mapLegacyCoffeeRecord({ booleanValue: false, habitName: 'Café' })).toEqual({
      status: 'not_consumed',
      confidence: 'exact',
    });
  });

  it('ignores records that are not about coffee', () => {
    expect(mapLegacyCoffeeRecord({ booleanValue: true, habitName: 'Água' })).toEqual({
      status: null,
      confidence: 'not_coffee',
    });
  });
});

describe('summarizeCoffee', () => {
  it('counts each explicit state and keeps unmapped legacy records apart', () => {
    const summary = summarizeCoffee([
      { localDate: '2026-07-01', status: 'without_sugar' },
      { localDate: '2026-07-02', status: 'without_sugar' },
      { localDate: '2026-07-03', status: 'with_sugar' },
      { localDate: '2026-07-04', status: 'not_consumed' },
      { localDate: '2026-07-05', status: null },
    ]);
    expect(summary).toEqual({
      days: 5,
      notConsumed: 1,
      unclassified: 1,
      withSugar: 1,
      withoutSugar: 2,
    });
  });
});
