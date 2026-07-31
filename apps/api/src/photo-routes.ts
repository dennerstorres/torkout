import {
  MAX_PROGRESS_PHOTO_BYTES,
  PROGRESS_PHOTO_GUIDANCE,
  progressPhotoComparisonQuerySchema,
  progressPhotoListSchema,
  progressPhotoUploadSchema,
} from '@torkout/contracts';
import { bodyMeasurements, progressPhotos, type DatabaseClient } from '@torkout/database';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, lte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ApiHttpError, type ApiDependencies, requireAuthenticatedUser } from './auth-routes.js';
import { progressPhotoStorageKey, type ObjectStorage } from './storage.js';

const idParamsSchema = z.strictObject({ id: z.uuid() });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiHttpError(400, 'VALIDATION_ERROR', 'Dados inválidos.');
  return result.data;
}

function requireStorage(dependencies: ApiDependencies): ObjectStorage {
  if (!dependencies.storage) {
    throw new ApiHttpError(
      503,
      'PHOTO_STORAGE_UNAVAILABLE',
      'O armazenamento de fotos não está configurado.',
    );
  }
  return dependencies.storage;
}

type PhotoRow = typeof progressPhotos.$inferSelect;
type MeasurementRow = typeof bodyMeasurements.$inferSelect;

/** Nunca expõe `storageKey`: o binário só é acessível pela rota autenticada de conteúdo. */
function photoView(row: PhotoRow, measurement?: MeasurementRow | undefined) {
  return {
    byteSize: row.byteSize,
    capturedAt: row.capturedAt?.toISOString() ?? null,
    contentType: row.contentType as 'image/jpeg' | 'image/png' | 'image/webp',
    createdAt: row.createdAt.toISOString(),
    heightPx: row.heightPx,
    id: row.id,
    localDate: row.localDate,
    measurement: measurement
      ? {
          abdomenCm: measurement.abdomenCm === null ? null : Number(measurement.abdomenCm),
          id: measurement.id,
          waistCm: measurement.waistCm === null ? null : Number(measurement.waistCm),
          weightKg: measurement.weightKg === null ? null : Number(measurement.weightKg),
        }
      : null,
    notes: row.notes,
    pose: row.pose,
    version: row.version,
    widthPx: row.widthPx,
  };
}

async function loadOwnedPhoto(
  database: DatabaseClient,
  userId: string,
  id: string,
): Promise<PhotoRow> {
  const [row] = await database
    .select()
    .from(progressPhotos)
    .where(
      and(
        eq(progressPhotos.id, id),
        eq(progressPhotos.userId, userId),
        isNull(progressPhotos.deletedAt),
      ),
    )
    .limit(1);
  // Um identificador de outra conta responde 404, sem revelar que o registro existe.
  if (!row) throw new ApiHttpError(404, 'PHOTO_NOT_FOUND', 'Foto não encontrada.');
  return row;
}

/**
 * Associa a foto à medição do mesmo dia, quando existir, para que peso e medidas apareçam junto da
 * imagem sem duplicar dados.
 */
async function measurementsFor(
  database: DatabaseClient,
  userId: string,
  rows: PhotoRow[],
): Promise<Map<string, MeasurementRow>> {
  if (rows.length === 0) return new Map();
  const dates = new Set(rows.map((row) => row.localDate));
  const measurements = await database
    .select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.userId, userId), isNull(bodyMeasurements.deletedAt)))
    .orderBy(asc(bodyMeasurements.measuredAt));
  const byDate = new Map<string, MeasurementRow>();
  for (const measurement of measurements) {
    if (dates.has(measurement.localDate)) byDate.set(measurement.localDate, measurement);
  }
  const byId = new Map<string, MeasurementRow>();
  for (const row of rows) {
    const explicit = row.measurementId
      ? measurements.find((item) => item.id === row.measurementId)
      : undefined;
    const linked = explicit ?? byDate.get(row.localDate);
    if (linked) byId.set(row.id, linked);
  }
  return byId;
}

export function registerPhotoRoutes(app: FastifyInstance, dependencies: ApiDependencies): void {
  app.get('/api/v1/progress-photos', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const rows = await dependencies.database
      .select()
      .from(progressPhotos)
      .where(and(eq(progressPhotos.userId, user.id), isNull(progressPhotos.deletedAt)))
      .orderBy(desc(progressPhotos.localDate), asc(progressPhotos.pose));
    const measurements = await measurementsFor(dependencies.database, user.id, rows);
    return progressPhotoListSchema.parse({
      guidance: [...PROGRESS_PHOTO_GUIDANCE],
      items: rows.map((row) => photoView(row, measurements.get(row.id))),
    });
  });

  app.get('/api/v1/progress-photos/comparison', async (request) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const query = parse(progressPhotoComparisonQuerySchema, request.query);
    const rows = await dependencies.database
      .select()
      .from(progressPhotos)
      .where(and(eq(progressPhotos.userId, user.id), isNull(progressPhotos.deletedAt)))
      .orderBy(asc(progressPhotos.localDate));
    const filtered = query.pose ? rows.filter((row) => row.pose === query.pose) : rows;
    const measurements = await measurementsFor(dependencies.database, user.id, filtered);
    const pick = (localDate: string) =>
      filtered
        .filter((row) => row.localDate === localDate)
        .map((row) => photoView(row, measurements.get(row.id)));
    return {
      from: { items: pick(query.from), localDate: query.from },
      to: { items: pick(query.to), localDate: query.to },
    };
  });

  app.post('/api/v1/progress-photos', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const storage = requireStorage(dependencies);
    const input = parse(progressPhotoUploadSchema, request.body);
    const body = Buffer.from(input.data, 'base64');
    if (body.byteLength === 0 || body.byteLength > MAX_PROGRESS_PHOTO_BYTES) {
      throw new ApiHttpError(400, 'PHOTO_TOO_LARGE', 'A imagem excede o tamanho permitido.');
    }
    if (input.measurementId) {
      const [measurement] = await dependencies.database
        .select({ id: bodyMeasurements.id })
        .from(bodyMeasurements)
        .where(
          and(
            eq(bodyMeasurements.id, input.measurementId),
            eq(bodyMeasurements.userId, user.id),
            isNull(bodyMeasurements.deletedAt),
          ),
        )
        .limit(1);
      if (!measurement) {
        throw new ApiHttpError(400, 'INVALID_MEASUREMENT_LINK', 'Medição inválida.');
      }
    }
    const id = input.id ?? randomUUID();
    const storageKey = progressPhotoStorageKey(user.id, id, input.contentType);
    await storage.put(storageKey, body, input.contentType);
    try {
      const [created] = await dependencies.database
        .insert(progressPhotos)
        .values({
          byteSize: body.byteLength,
          capturedAt: input.capturedAt ? new Date(input.capturedAt) : null,
          contentType: input.contentType,
          heightPx: input.heightPx ?? null,
          id,
          localDate: input.localDate,
          measurementId: input.measurementId ?? null,
          notes: input.notes ?? null,
          pose: input.pose,
          storageKey,
          userId: user.id,
          widthPx: input.widthPx ?? null,
        })
        .returning();
      if (!created) throw new Error('Progress photo insert did not return a row.');
      const measurements = await measurementsFor(dependencies.database, user.id, [created]);
      return reply.status(201).send(photoView(created, measurements.get(created.id)));
    } catch (error) {
      await storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
  });

  app.get('/api/v1/progress-photos/:id/content', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const storage = requireStorage(dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const photo = await loadOwnedPhoto(dependencies.database, user.id, id);
    let body: Buffer;
    try {
      body = await storage.read(photo.storageKey);
    } catch {
      throw new ApiHttpError(404, 'PHOTO_CONTENT_NOT_FOUND', 'Imagem não encontrada.');
    }
    return reply
      .type(photo.contentType)
      .header('cache-control', 'private, no-store')
      .header('content-disposition', 'inline')
      .send(body);
  });

  app.delete('/api/v1/progress-photos/:id', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, dependencies);
    const storage = requireStorage(dependencies);
    const { id } = parse(idParamsSchema, request.params);
    const photo = await loadOwnedPhoto(dependencies.database, user.id, id);
    await dependencies.database
      .update(progressPhotos)
      .set({ deletedAt: new Date() })
      .where(and(eq(progressPhotos.id, id), eq(progressPhotos.userId, user.id)));
    await storage.remove(photo.storageKey).catch(() => undefined);
    return reply.status(204).send();
  });
}

export async function deleteProgressPhotoObjects(
  database: DatabaseClient,
  storage: ObjectStorage | undefined,
  userId: string,
  now = new Date(),
): Promise<number> {
  if (!storage) return 0;
  const rows = await database
    .select({ storageKey: progressPhotos.storageKey })
    .from(progressPhotos)
    .where(and(eq(progressPhotos.userId, userId), lte(progressPhotos.createdAt, now)));
  for (const row of rows) await storage.remove(row.storageKey).catch(() => undefined);
  return rows.length;
}
