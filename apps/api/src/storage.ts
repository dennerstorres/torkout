import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

/**
 * Abstração mínima de armazenamento de objetos. O driver local grava em um diretório que pode ser
 * um volume persistente; um driver S3 pode ser adicionado depois implementando esta mesma interface,
 * sem tocar nas rotas. Imagens nunca são gravadas no PostgreSQL.
 */
export interface ObjectStorage {
  exists(key: string): Promise<boolean>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
}

const KEY_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,255}$/i;

function assertSafeKey(key: string): string {
  if (!KEY_PATTERN.test(key) || key.includes('..') || key.includes('\\') || key.includes('//')) {
    throw new Error(`Chave de armazenamento inválida: ${key}`);
  }
  return key;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** As chaves são particionadas por usuário para que o isolamento seja visível no próprio caminho. */
export function progressPhotoStorageKey(
  userId: string,
  photoId: string,
  contentType: string,
): string {
  const extension = EXTENSIONS[contentType];
  if (!extension) throw new Error(`Tipo de imagem não suportado: ${contentType}`);
  return assertSafeKey(`users/${userId}/progress-photos/${photoId}.${extension}`);
}

export function createLocalObjectStorage(root: string): ObjectStorage {
  const absoluteRoot = resolve(root);

  function pathOf(key: string): string {
    const target = resolve(join(absoluteRoot, assertSafeKey(key)));
    const inside = relative(absoluteRoot, target);
    if (inside === '' || inside.startsWith('..') || inside.startsWith(sep)) {
      throw new Error(`Chave de armazenamento inválida: ${key}`);
    }
    return target;
  }

  return {
    async exists(key) {
      try {
        await stat(pathOf(key));
        return true;
      } catch {
        return false;
      }
    },
    async put(key, body, contentType) {
      void contentType;
      const target = pathOf(key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body, { flag: 'w', mode: 0o600 });
    },
    async read(key) {
      return readFile(pathOf(key));
    },
    async remove(key) {
      await rm(pathOf(key), { force: true });
    },
  };
}
