import { z } from 'zod';

const timeZoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: value }).format();
    return value.includes('/');
  } catch {
    return false;
  }
}, 'Fuso horário IANA inválido');

const localTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Horário local inválido');

export const profileUpdateSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(100),
  enabledInitialHabits: z
    .array(z.enum(['coffee', 'rice', 'protein', 'salad']))
    .max(4)
    .default([]),
  /** Objetivo declarado pelo usuário; texto livre e opcional. */
  goal: z.string().trim().max(500).nullable().optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  initialWaistCm: z.number().positive().max(500).optional(),
  initialWeightKg: z.number().positive().max(1_000).optional(),
  locale: z.enum(['pt-BR']),
  nonMedicalDisclaimerAccepted: z.literal(true),
  preferredWorkoutTime: localTimeSchema.nullable().optional(),
  timeZone: timeZoneSchema,
  unitSystem: z.literal('metric'),
});

export const privacyDocumentTypeSchema = z.enum(['privacy_notice', 'terms', 'health_data_consent']);

export const privacyAcceptanceSchema = z.strictObject({
  documentVersions: z
    .record(privacyDocumentTypeSchema, z.string().trim().min(1).max(50))
    .refine(
      (versions) => Object.keys(versions).length === 3,
      'Todos os documentos são obrigatórios',
    ),
});

export const accountDeletionSchema = z.strictObject({
  confirmation: z.literal('EXCLUIR MINHA CONTA'),
  password: z.string().min(8).max(128),
});

export const adminAccountBlockSchema = z.strictObject({
  expiresAt: z.iso.datetime().nullable().default(null),
  reason: z.enum(['abuse', 'automated_activity', 'terms_violation']),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type PrivacyAcceptance = z.infer<typeof privacyAcceptanceSchema>;
