import { z } from 'zod';

const nullableNotes = z.string().trim().max(2_000).nullable().optional();

/**
 * Café é registrado como estado explícito. "Sem açúcar" nunca pode ser confundido com ausência de
 * consumo, e a ausência de registro nunca vira "não consumi".
 */
export const coffeeStatusSchema = z.enum(['not_consumed', 'without_sugar', 'with_sugar']);

const coffeeFields = {
  localDate: z.iso.date(),
  notes: nullableNotes,
  recordedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  status: coffeeStatusSchema,
};

export const coffeeIntakeCreateSchema = z.strictObject({
  id: z.uuid().optional(),
  ...coffeeFields,
});

export const coffeeIntakeUpdateSchema = z
  .strictObject(coffeeFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para alterar.');

export const wheyMixBaseSchema = z.enum([
  'water',
  'whole_milk',
  'semi_skimmed_milk',
  'skimmed_milk',
  'other',
]);

/**
 * Formato do produto. Whey em pó, proteína pronta para beber (YoPro) e iogurte proteico dividem o
 * mesmo histórico: só o preparo muda.
 */
export const proteinFormatSchema = z.enum(['powder', 'ready_to_drink', 'yogurt']);

/** Medida da dose. Uma por registro: ou scoop, ou colher de sopa, ou unidade consumida. */
export const proteinServingUnitSchema = z.enum(['scoop', 'tablespoon', 'unit']);

export const wheyMomentSchema = z.enum([
  'morning',
  'pre_workout',
  'post_workout',
  'night',
  'other',
]);

/** Registro descritivo de tolerância. Nenhuma recomendação clínica é derivada destes valores. */
export const wheyToleranceSchema = z.enum([
  'none',
  'gas',
  'bloating',
  'cramp',
  'diarrhea',
  'nausea',
  'other',
]);

const wheyFields = {
  blendedWith: z.string().trim().min(1).max(200).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  consumed: z.boolean(),
  customMixedWith: z.string().trim().min(1).max(120).nullable().optional(),
  format: proteinFormatSchema.default('powder'),
  liquidMl: z.number().nonnegative().max(5_000).nullable().optional(),
  localDate: z.iso.date(),
  localTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe o horário no formato HH:MM.')
    .nullable()
    .optional(),
  mixedWith: wheyMixBaseSchema.nullable().optional(),
  moment: wheyMomentSchema.nullable().optional(),
  notes: nullableNotes,
  powderGrams: z.number().nonnegative().max(1_000).nullable().optional(),
  product: z.string().trim().max(120).nullable().optional(),
  proteinPerServingGrams: z.number().nonnegative().max(200).nullable().optional(),
  servingUnit: proteinServingUnitSchema.nullable().optional(),
  servings: z.number().nonnegative().max(20).nullable().optional(),
  tolerance: z.array(wheyToleranceSchema).max(7).default([]),
};

interface WheyShape {
  blendedWith?: string | null | undefined;
  consumed?: boolean | undefined;
  customMixedWith?: string | null | undefined;
  format?: z.infer<typeof proteinFormatSchema> | undefined;
  liquidMl?: number | null | undefined;
  mixedWith?: z.infer<typeof wheyMixBaseSchema> | null | undefined;
  moment?: z.infer<typeof wheyMomentSchema> | null | undefined;
  powderGrams?: number | null | undefined;
  proteinPerServingGrams?: number | null | undefined;
  servingUnit?: z.infer<typeof proteinServingUnitSchema> | null | undefined;
  servings?: number | null | undefined;
  tolerance?: Array<z.infer<typeof wheyToleranceSchema>> | undefined;
}

const WHEY_DETAIL_KEYS = [
  'blendedWith',
  'customMixedWith',
  'liquidMl',
  'mixedWith',
  'moment',
  'powderGrams',
  'proteinPerServingGrams',
  'servingUnit',
  'servings',
] as const satisfies ReadonlyArray<keyof WheyShape>;

/** Preparo de pó dissolvido. Uma garrafa pronta ou um pote de iogurte não têm nada disso. */
const POWDER_ONLY_KEYS = [
  'blendedWith',
  'customMixedWith',
  'liquidMl',
  'mixedWith',
  'powderGrams',
] as const satisfies ReadonlyArray<keyof WheyShape>;

const POWDER_SERVING_UNITS = new Set(['scoop', 'tablespoon']);

/**
 * `partial` distingue criação de alteração: na alteração parcial o campo ausente continua valendo no
 * banco e não pode ser lido como vazio. O par que só o registro gravado conhece fica com a constraint
 * do PostgreSQL.
 */
function validateWhey(
  value: WheyShape,
  context: z.RefinementCtx,
  options: { partial: boolean } = { partial: false },
): void {
  if (value.mixedWith === 'other' && !value.customMixedWith) {
    context.addIssue({
      code: 'custom',
      message: 'Informe com o que o whey foi misturado.',
      path: ['customMixedWith'],
    });
  }
  if (value.mixedWith !== 'other' && value.customMixedWith != null) {
    context.addIssue({
      code: 'custom',
      message: 'A descrição livre só é válida para "outro".',
      path: ['customMixedWith'],
    });
  }
  const tolerance = value.tolerance ?? [];
  if (tolerance.includes('none') && tolerance.length > 1) {
    context.addIssue({
      code: 'custom',
      message: '"Sem desconforto" não pode ser combinado com outras ocorrências.',
      path: ['tolerance'],
    });
  }
  if (new Set(tolerance).size !== tolerance.length) {
    context.addIssue({
      code: 'custom',
      message: 'Não repita a mesma ocorrência.',
      path: ['tolerance'],
    });
  }
  if (value.consumed === false) {
    for (const key of WHEY_DETAIL_KEYS) {
      if (value[key] != null) {
        context.addIssue({
          code: 'custom',
          message: 'Não registre quantidades quando a proteína não foi consumida.',
          path: [key],
        });
      }
    }
  }
  const format = value.format;
  if (format !== undefined && format !== 'powder') {
    for (const key of POWDER_ONLY_KEYS) {
      if (value[key] != null) {
        context.addIssue({
          code: 'custom',
          message: 'Este campo pertence ao preparo do pó.',
          path: [key],
        });
      }
    }
  }
  if (value.servingUnit != null && format !== undefined) {
    const allowed =
      format === 'powder'
        ? POWDER_SERVING_UNITS.has(value.servingUnit)
        : value.servingUnit === 'unit';
    if (!allowed) {
      context.addIssue({
        code: 'custom',
        message:
          format === 'powder'
            ? 'Meça o pó em scoop ou em colher de sopa.'
            : 'Proteína pronta para beber e iogurte são contados por unidade.',
        path: ['servingUnit'],
      });
    }
  }
  const declaresServings = !options.partial || 'servings' in value;
  if (value.servingUnit != null && declaresServings && value.servings == null) {
    context.addIssue({
      code: 'custom',
      message: 'Informe quantas porções a medida representa.',
      path: ['servings'],
    });
  }
}

export const wheyIntakeCreateSchema = z
  .strictObject({ id: z.uuid().optional(), ...wheyFields })
  .superRefine(validateWhey);

export const wheyIntakeUpdateSchema = z
  .strictObject({
    ...wheyFields,
    format: wheyFields.format.optional(),
    tolerance: wheyFields.tolerance.optional(),
  })
  .partial()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: 'custom', message: 'Informe ao menos um campo para alterar.' });
    }
    validateWhey(value, context, { partial: true });
  });

export type CoffeeIntakeCreate = z.infer<typeof coffeeIntakeCreateSchema>;
export type ProteinFormat = z.infer<typeof proteinFormatSchema>;
export type ProteinServingUnit = z.infer<typeof proteinServingUnitSchema>;
export type CoffeeStatus = z.infer<typeof coffeeStatusSchema>;
export type WheyIntakeCreate = z.infer<typeof wheyIntakeCreateSchema>;
export type WheyMixBase = z.infer<typeof wheyMixBaseSchema>;
export type WheyMoment = z.infer<typeof wheyMomentSchema>;
export type WheyTolerance = z.infer<typeof wheyToleranceSchema>;
