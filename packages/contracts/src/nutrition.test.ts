import { describe, expect, it } from 'vitest';

import {
  coffeeIntakeCreateSchema,
  coffeeIntakeUpdateSchema,
  wheyIntakeCreateSchema,
  wheyIntakeUpdateSchema,
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

describe('protein format', () => {
  const base = { consumed: true, localDate: '2026-08-25' };

  it('reads a record without a declared format as powder', () => {
    expect(wheyIntakeCreateSchema.parse(base).format).toBe('powder');
  });

  it('accepts a ready to drink bottle with no powder at all', () => {
    const parsed = wheyIntakeCreateSchema.safeParse({
      ...base,
      brand: 'YoPro',
      format: 'ready_to_drink',
      product: 'Morango',
      proteinPerServingGrams: 25,
      servingUnit: 'unit',
      servings: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects powder preparation fields outside the powder format', () => {
    for (const field of [
      { powderGrams: 30 },
      { mixedWith: 'skimmed_milk' as const },
      { liquidMl: 300 },
      { blendedWith: 'Banana e abacate' },
    ]) {
      expect(
        wheyIntakeCreateSchema.safeParse({ ...base, format: 'ready_to_drink', ...field }).success,
      ).toBe(false);
    }
  });

  it('rejects a format the application does not register', () => {
    expect(wheyIntakeCreateSchema.safeParse({ ...base, format: 'bar' }).success).toBe(false);
  });
});

describe('protein serving unit', () => {
  const base = { consumed: true, localDate: '2026-08-25' };

  it('measures the powder dose by scoop or by tablespoon', () => {
    for (const servingUnit of ['scoop', 'tablespoon'] as const) {
      expect(wheyIntakeCreateSchema.safeParse({ ...base, servingUnit, servings: 2 }).success).toBe(
        true,
      );
    }
  });

  it('keeps the unit tied to the format', () => {
    expect(
      wheyIntakeCreateSchema.safeParse({ ...base, servingUnit: 'unit', servings: 1 }).success,
    ).toBe(false);
    expect(
      wheyIntakeCreateSchema.safeParse({
        ...base,
        format: 'ready_to_drink',
        servingUnit: 'scoop',
        servings: 1,
      }).success,
    ).toBe(false);
  });

  it('does not accept a unit without the amount it measures', () => {
    expect(wheyIntakeCreateSchema.safeParse({ ...base, servingUnit: 'scoop' }).success).toBe(false);
  });

  it('accepts an update that only changes the unit', () => {
    expect(wheyIntakeUpdateSchema.safeParse({ servingUnit: 'tablespoon' }).success).toBe(true);
  });
});

describe('blended ingredients', () => {
  const base = { consumed: true, localDate: '2026-08-25' };

  it('records the fruit shake next to the liquid base', () => {
    const parsed = wheyIntakeCreateSchema.safeParse({
      ...base,
      blendedWith: 'Banana e abacate',
      liquidMl: 300,
      mixedWith: 'skimmed_milk',
      powderGrams: 30,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.blendedWith).toBe('Banana e abacate');
  });

  it('does not accept ingredients when the protein was not consumed', () => {
    expect(
      wheyIntakeCreateSchema.safeParse({
        blendedWith: 'Banana e abacate',
        consumed: false,
        localDate: '2026-08-25',
      }).success,
    ).toBe(false);
  });

  it('rejects an empty description instead of storing blank text', () => {
    expect(wheyIntakeCreateSchema.safeParse({ ...base, blendedWith: '   ' }).success).toBe(false);
  });
});
