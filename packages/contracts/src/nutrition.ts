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
  brand: z.string().trim().max(120).nullable().optional(),
  consumed: z.boolean(),
  customMixedWith: z.string().trim().min(1).max(120).nullable().optional(),
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
  servings: z.number().nonnegative().max(20).nullable().optional(),
  tolerance: z.array(wheyToleranceSchema).max(7).default([]),
};

interface WheyShape {
  consumed?: boolean | undefined;
  customMixedWith?: string | null | undefined;
  liquidMl?: number | null | undefined;
  mixedWith?: z.infer<typeof wheyMixBaseSchema> | null | undefined;
  moment?: z.infer<typeof wheyMomentSchema> | null | undefined;
  powderGrams?: number | null | undefined;
  proteinPerServingGrams?: number | null | undefined;
  servings?: number | null | undefined;
  tolerance?: Array<z.infer<typeof wheyToleranceSchema>> | undefined;
}

const WHEY_DETAIL_KEYS = [
  'customMixedWith',
  'liquidMl',
  'mixedWith',
  'moment',
  'powderGrams',
  'proteinPerServingGrams',
  'servings',
] as const satisfies ReadonlyArray<keyof WheyShape>;

function validateWhey(value: WheyShape, context: z.RefinementCtx): void {
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
          message: 'Não registre quantidades quando o whey não foi consumido.',
          path: [key],
        });
      }
    }
  }
}

export const wheyIntakeCreateSchema = z
  .strictObject({ id: z.uuid().optional(), ...wheyFields })
  .superRefine(validateWhey);

export const wheyIntakeUpdateSchema = z
  .strictObject({ ...wheyFields, tolerance: wheyFields.tolerance.optional() })
  .partial()
  .superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
      context.addIssue({ code: 'custom', message: 'Informe ao menos um campo para alterar.' });
    }
    validateWhey(value, context);
  });

export type CoffeeIntakeCreate = z.infer<typeof coffeeIntakeCreateSchema>;
export type CoffeeStatus = z.infer<typeof coffeeStatusSchema>;
export type WheyIntakeCreate = z.infer<typeof wheyIntakeCreateSchema>;
export type WheyMixBase = z.infer<typeof wheyMixBaseSchema>;
export type WheyMoment = z.infer<typeof wheyMomentSchema>;
export type WheyTolerance = z.infer<typeof wheyToleranceSchema>;
