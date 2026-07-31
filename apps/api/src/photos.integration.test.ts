import { createDatabaseClient, migrateDatabase } from '@torkout/database';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { createLocalObjectStorage } from './storage.js';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
}

const { db, pool } = createDatabaseClient(connectionString);
const users = {
  first: 'a9000000-0000-4000-8000-000000000001',
  second: 'a9000000-0000-4000-8000-000000000002',
};
const ids = {
  firstPhoto: 'a9100000-0000-4000-8000-000000000001',
  secondPhoto: 'a9100000-0000-4000-8000-000000000002',
};

// PNG mínimo válido de 1×1 pixel.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const storageRoot = mkdtempSync(join(tmpdir(), 'torkout-photos-'));

const fakeAuth = {
  api: {
    async deleteUser() {
      return { success: true };
    },
    async getSession(input: { headers: Headers }) {
      const userId = input.headers.get('x-user-id');
      return userId
        ? {
            session: { id: `session-${userId}`, userId },
            user: { emailVerified: true, id: userId },
          }
        : null;
    },
    async verifyPassword() {
      return { status: true };
    },
  },
  async handler() {
    return new Response(null, { status: 501 });
  },
};

const app = buildApp({
  auth: fakeAuth,
  database: db,
  storage: createLocalObjectStorage(storageRoot),
  trustedOrigins: ['https://torkout.example.test'],
});

async function request(
  userId: string | null,
  method: 'DELETE' | 'GET' | 'POST',
  url: string,
  payload?: Record<string, unknown>,
) {
  return app.inject({
    headers: {
      origin: 'https://torkout.example.test',
      ...(userId ? { 'x-user-id': userId } : {}),
    },
    method,
    ...(payload ? { payload } : {}),
    url,
  });
}

describe('progress photos API', () => {
  beforeAll(async () => {
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('drop schema public cascade');
    await pool.query('create schema public');
    await migrateDatabase(db);
    await pool.query(
      `insert into users (id, name, email, email_verified) values
       ($1, 'Primeira', 'photos-first@example.invalid', true),
       ($2, 'Segunda', 'photos-second@example.invalid', true)`,
      [users.first, users.second],
    );
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    rmSync(storageRoot, { force: true, recursive: true });
  });

  it('stores a photo and returns only metadata, never the storage key', async () => {
    const created = await request(users.first, 'POST', '/api/v1/progress-photos', {
      contentType: 'image/png',
      data: PNG_BASE64,
      id: ids.firstPhoto,
      localDate: '2026-07-14',
      notes: 'Mesma iluminação da última vez.',
      pose: 'front',
    });

    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body).toMatchObject({ id: ids.firstPhoto, localDate: '2026-07-14', pose: 'front' });
    expect(body.byteSize).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain('progress-photos/');
    expect(JSON.stringify(body)).not.toMatch(/https?:\/\//);
  });

  it('serves the binary only through an authenticated route with private caching', async () => {
    const content = await request(
      users.first,
      'GET',
      `/api/v1/progress-photos/${ids.firstPhoto}/content`,
    );
    expect(content.statusCode).toBe(200);
    expect(content.headers['content-type']).toContain('image/png');
    expect(content.headers['cache-control']).toBe('private, no-store');
  });

  it('rejects an anonymous request for the binary', async () => {
    const content = await request(null, 'GET', `/api/v1/progress-photos/${ids.firstPhoto}/content`);
    expect(content.statusCode).toBe(401);
  });

  it('never lets another account read the metadata of a photo', async () => {
    const list = await request(users.second, 'GET', '/api/v1/progress-photos');
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toEqual([]);
  });

  it('never lets another account read the binary of a photo', async () => {
    const content = await request(
      users.second,
      'GET',
      `/api/v1/progress-photos/${ids.firstPhoto}/content`,
    );
    expect(content.statusCode).toBe(404);
    expect(content.json()).toMatchObject({ code: 'PHOTO_NOT_FOUND' });
  });

  it('never lets another account delete a photo', async () => {
    const removed = await request(
      users.second,
      'DELETE',
      `/api/v1/progress-photos/${ids.firstPhoto}`,
    );
    expect(removed.statusCode).toBe(404);
    const stillThere = await request(users.first, 'GET', '/api/v1/progress-photos');
    expect(stillThere.json().items).toHaveLength(1);
  });

  it('links the photo to the measurement recorded on the same day', async () => {
    const measurement = await request(users.first, 'POST', '/api/v1/measurements', {
      abdomenCm: 90,
      localDate: '2026-07-20',
      measuredAt: '2026-07-20T10:00:00.000Z',
      waistCm: 84,
      weightKg: 70.5,
    });
    expect(measurement.statusCode).toBe(201);

    const created = await request(users.first, 'POST', '/api/v1/progress-photos', {
      contentType: 'image/png',
      data: PNG_BASE64,
      id: ids.secondPhoto,
      localDate: '2026-07-20',
      pose: 'side',
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().measurement).toMatchObject({
      abdomenCm: 90,
      waistCm: 84,
      weightKg: 70.5,
    });
  });

  it('compares two dates without mixing the poses', async () => {
    const comparison = await request(
      users.first,
      'GET',
      '/api/v1/progress-photos/comparison?from=2026-07-14&to=2026-07-20&pose=front',
    );
    expect(comparison.statusCode).toBe(200);
    const body = comparison.json();
    expect(body.from.items).toHaveLength(1);
    expect(body.to.items).toHaveLength(0);
  });

  it('deletes explicitly and stops serving the binary', async () => {
    const removed = await request(
      users.first,
      'DELETE',
      `/api/v1/progress-photos/${ids.firstPhoto}`,
    );
    expect(removed.statusCode).toBe(204);

    const content = await request(
      users.first,
      'GET',
      `/api/v1/progress-photos/${ids.firstPhoto}/content`,
    );
    expect(content.statusCode).toBe(404);

    const list = await request(users.first, 'GET', '/api/v1/progress-photos');
    expect(list.json().items.map((item: { id: string }) => item.id)).toEqual([ids.secondPhoto]);
  });

  it('rejects an unsupported image type', async () => {
    const created = await request(users.first, 'POST', '/api/v1/progress-photos', {
      contentType: 'application/pdf',
      data: PNG_BASE64,
      localDate: '2026-07-21',
      pose: 'back',
    });
    expect(created.statusCode).toBe(400);
  });
});
