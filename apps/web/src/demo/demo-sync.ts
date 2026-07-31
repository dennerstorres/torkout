import type { SyncTransport } from '../sync/sync-coordinator';

/**
 * Conta usada pelo modo demonstração. É um UUID fixo e reservado: a réplica local é particionada
 * por usuário, então a demonstração ganha um banco próprio, separado de qualquer conta real.
 */
export const DEMO_USER_ID = 'dcd00000-0000-4000-8000-000000000001';

/**
 * Transporte do modo demonstração. Ele recusa, em vez de apenas não ser acionado: se algum caminho
 * futuro disparar sincronização durante a demonstração, a recusa é explícita e nada sai do
 * aparelho.
 */
export class DemoSyncBlockedError extends Error {
  constructor() {
    super('DEMO_SYNC_BLOCKED');
    this.name = 'DemoSyncBlockedError';
  }
}

export const demoSyncTransport: SyncTransport = {
  async pull(): Promise<never> {
    throw new DemoSyncBlockedError();
  },
  async push(): Promise<never> {
    throw new DemoSyncBlockedError();
  },
};
