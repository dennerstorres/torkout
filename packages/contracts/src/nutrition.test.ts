import { describe, expect, it } from 'vitest';

import {
  coffeeIntakeCreateSchema,
  coffeeIntakeUpdateSchema,
  wheyIntakeCreateSchema,
} from './nutrition.js';

describe('coffee intake contract', () => {
  it('accepts the three explicit states', () => {
    for (const status of ['not_consumed', 'without_sugar', 'with_sugar'] as const) {
      expect(coffeeIntakeCreateSchema.safeParse({ localDate: '2026-07-24', status }).success).toBe(
        true,
      );
    }
  });

  it('rejects a legacy boolean answer', () => {
    expect(
      coffeeIntakeCreateSchema.safeParse({ consumed: true, localDate: '2026-07-24' }).success,
    ).toBe(false);
    expect(
      coffeeIntakeCreateSchema.safeParse({ localDate: '2026-07-24', status: 'sim' }).success,
    ).toBe(false);
  });

  it('requires at least one field on update', () => {
    expect(coffeeIntakeUpdateSchema.safeParse({}).success).toBe(false);
    expect(coffeeIntakeUpdateSchema.safeParse({ status: 'with_sugar' }).success).toBe(true);
  });
});

describe('whey intake contract', () => {
  const base = { consumed: true, localDate: '2026-07-24' };

  it('accepts a complete record', () => {
    const parsed = wheyIntakeCreateSchema.safeParse({
      ...base,
      brand: 'Marca',
      liquidMl: 300,
      localTime: '19:30',
      mixedWith: 'skimmed_milk',
      moment: 'post_workout',
      notes: 'Sem alterações.',
      powderGrams: 30,
      product: 'Baunilha',
      proteinPerServingGrams: 24,
      servings: 1,
      tolerance: ['none'],
    });
    expect(parsed.success).toBe(true);
  });

  it('defaults tolerance to an empty list', () => {
    const parsed = wheyIntakeCreateSchema.parse(base);
    expect(parsed.tolerance).toEqual([]);
  });

  it('accepts more than one tolerance occurrence', () => {
    expect(
      wheyIntakeCreateSchema.safeParse({ ...base, tolerance: ['gas', 'bloating'] }).success,
    ).toBe(true);
  });

  it('does not allow "sem desconforto" together with an occurrence', () => {
    expect(wheyIntakeCreateSchema.safeParse({ ...base, tolerance: ['none', 'gas'] }).success).toBe(
      false,
    );
  });

  it('requires the free text only when the liquid is "other"', () => {
    expect(wheyIntakeCreateSchema.safeParse({ ...base, mixedWith: 'other' }).success).toBe(false);
    expect(
      wheyIntakeCreateSchema.safeParse({ ...base, customMixedWith: 'Suco', mixedWith: 'other' })
        .success,
    ).toBe(true);
    expect(
      wheyIntakeCreateSchema.safeParse({ ...base, customMixedWith: 'Suco', mixedWith: 'water' })
        .success,
    ).toBe(false);
  });

  it('does not accept quantities when the user did not consume whey', () => {
    expect(
      wheyIntakeCreateSchema.safeParse({
        consumed: false,
        localDate: '2026-07-24',
        powderGrams: 30,
      }).success,
    ).toBe(false);
    expect(
      wheyIntakeCreateSchema.safeParse({ consumed: false, localDate: '2026-07-24' }).success,
    ).toBe(true);
  });

  it('keeps every detail optional so the form stays quick', () => {
    expect(wheyIntakeCreateSchema.safeParse(base).success).toBe(true);
  });
});
