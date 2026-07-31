import { z } from 'zod';

/**
 * Fotos de evolução são privadas: o binário nunca é servido por URL pública nem assinada, apenas
 * por rota autenticada e verificada contra o dono do registro.
 */
export const MAX_PROGRESS_PHOTO_BYTES = 5 * 1024 * 1024;

export const progressPhotoPoseSchema = z.enum(['front', 'side', 'back']);

export const progressPhotoContentTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

export const PROGRESS_PHOTO_GUIDANCE = [
  'Repita a mesma iluminação e o mesmo cômodo.',
  'Mantenha a mesma distância da câmera e a mesma altura do enquadramento.',
  'Use roupa semelhante em todas as fotos.',
  'Repita a mesma posição corporal e mantenha a postura relaxada.',
] as const;

const nullableNotes = z.string().trim().max(2_000).nullable().optional();

export const progressPhotoUploadSchema = z.strictObject({
  capturedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  contentType: progressPhotoContentTypeSchema,
  data: z
    .base64()
    .max(Math.ceil(MAX_PROGRESS_PHOTO_BYTES / 3) * 4, 'A imagem excede o tamanho permitido.'),
  heightPx: z.number().int().positive().max(20_000).nullable().optional(),
  id: z.uuid().optional(),
  localDate: z.iso.date(),
  measurementId: z.uuid().nullable().optional(),
  notes: nullableNotes,
  pose: progressPhotoPoseSchema,
  widthPx: z.number().int().positive().max(20_000).nullable().optional(),
});

/** Somente metadados. O corpo binário e a chave de armazenamento nunca são expostos. */
export const progressPhotoSchema = z.strictObject({
  byteSize: z.number().int().nonnegative(),
  capturedAt: z.iso.datetime({ offset: true }).nullable(),
  contentType: progressPhotoContentTypeSchema,
  createdAt: z.iso.datetime({ offset: true }),
  heightPx: z.number().int().positive().nullable(),
  id: z.uuid(),
  localDate: z.iso.date(),
  measurement: z
    .strictObject({
      abdomenCm: z.number().nullable(),
      id: z.uuid(),
      waistCm: z.number().nullable(),
      weightKg: z.number().nullable(),
    })
    .nullable(),
  notes: z.string().nullable(),
  pose: progressPhotoPoseSchema,
  version: z.number().int().positive(),
  widthPx: z.number().int().positive().nullable(),
});

export const progressPhotoListSchema = z.strictObject({
  guidance: z.array(z.string().min(1)),
  items: z.array(progressPhotoSchema),
});

export const progressPhotoComparisonQuerySchema = z
  .strictObject({ from: z.iso.date(), pose: progressPhotoPoseSchema.optional(), to: z.iso.date() })
  .refine((query) => query.to >= query.from, 'A data final não pode anteceder a inicial.');

export type ProgressPhoto = z.infer<typeof progressPhotoSchema>;
export type ProgressPhotoList = z.infer<typeof progressPhotoListSchema>;
export type ProgressPhotoPose = z.infer<typeof progressPhotoPoseSchema>;
export type ProgressPhotoUpload = z.infer<typeof progressPhotoUploadSchema>;
