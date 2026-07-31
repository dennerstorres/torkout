import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createLocalObjectStorage, progressPhotoStorageKey } from './storage.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'torkout-storage-'));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const photoId = '33333333-3333-4333-8333-333333333333';

describe('progressPhotoStorageKey', () => {
  it('partitions objects by user so one account never reads another', () => {
    const key = progressPhotoStorageKey(userId, photoId, 'image/jpeg');
    expect(key.startsWith(`users/${userId}/progress-photos/`)).toBe(true);
    expect(key.endsWith('.jpg')).toBe(true);
    expect(progressPhotoStorageKey(otherUserId, photoId, 'image/jpeg')).not.toBe(key);
  });

  it('derives the extension from the content type', () => {
    expect(progressPhotoStorageKey(userId, photoId, 'image/png').endsWith('.png')).toBe(true);
    expect(progressPhotoStorageKey(userId, photoId, 'image/webp').endsWith('.webp')).toBe(true);
  });
});

describe('local object storage', () => {
  it('stores, reads and deletes an object', async () => {
    const storage = createLocalObjectStorage(root);
    const key = progressPhotoStorageKey(userId, photoId, 'image/jpeg');
    const body = Buffer.from('conteudo-binario');

    await storage.put(key, body, 'image/jpeg');
    expect(Buffer.compare(await storage.read(key), body)).toBe(0);

    await storage.remove(key);
    await expect(storage.read(key)).rejects.toThrow();
  });

  it('reports whether an object exists', async () => {
    const storage = createLocalObjectStorage(root);
    const key = progressPhotoStorageKey(userId, photoId, 'image/png');
    expect(await storage.exists(key)).toBe(false);
    await storage.put(key, Buffer.from('x'), 'image/png');
    expect(await storage.exists(key)).toBe(true);
  });

  it('never leaves the configured root when the key tries to traverse', async () => {
    const storage = createLocalObjectStorage(root);
    for (const key of ['../escape.jpg', 'users/../../escape.jpg', '/etc/passwd', 'a\\..\\b.jpg']) {
      await expect(storage.put(key, Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
        /chave de armazenamento/i,
      );
    }
    expect(readdirSync(root)).toEqual([]);
  });

  it('removing an object that does not exist is not an error', async () => {
    const storage = createLocalObjectStorage(root);
    await expect(
      storage.remove(progressPhotoStorageKey(userId, photoId, 'image/jpeg')),
    ).resolves.toBeUndefined();
  });
});

describe('empacotamento do diretório de objetos', () => {
  // Um volume nomeado do Docker herda dono e modo do diretório correspondente na
  // imagem. Se a imagem não criar o diretório, o volume nasce como root e a API,
  // que roda sem privilégio, não consegue gravar foto nenhuma.
  const compose = readFileSync(resolve(process.cwd(), 'compose.production.yml'), 'utf8');
  const dockerfile = readFileSync(resolve(process.cwd(), 'apps/api/Dockerfile'), 'utf8');
  const configuredDir = /OBJECT_STORAGE_DIR:\s*(\S+)/.exec(compose)?.[1];

  it('a produção configura um diretório absoluto para o driver local', () => {
    expect(configuredDir).toBeDefined();
    expect(configuredDir?.startsWith('/')).toBe(true);
  });

  it('a imagem cria o diretório configurado e o entrega ao usuário de runtime', () => {
    const runtimeUser = /^USER\s+(\S+)\s*$/m.exec(dockerfile)?.[1];
    expect(runtimeUser).toBeDefined();
    expect(dockerfile).toContain(configuredDir!);
    const chownIndex = dockerfile.indexOf(`chown -R ${runtimeUser}:${runtimeUser}`);
    expect(chownIndex).toBeGreaterThan(-1);
    // O preparo precisa acontecer enquanto ainda somos root.
    expect(chownIndex).toBeLessThan(dockerfile.lastIndexOf(`USER ${runtimeUser}`));
  });
});
