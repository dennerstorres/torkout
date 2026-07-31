import { useEffect, useMemo, useState } from 'react';

import type { LocalConflict, OutboxEntry } from './local-database';
import { createUserSyncDatabase } from './local-database';
import { httpSyncTransport } from './http-transport';
import {
  installSyncTriggers,
  SyncCoordinator,
  type SyncSnapshot,
  type SyncTransport,
} from './sync-coordinator';

const initialSnapshot: SyncSnapshot = {
  conflictCount: 0,
  lastError: null,
  pendingCount: 0,
  state: 'synced',
};

/**
 * O transporte é injetável para que o modo demonstração possa fornecer um que recusa envio. Sem
 * essa costura, a única garantia seria "a sincronização não é disparada", que é frágil demais para
 * dados que nunca podem sair do aparelho.
 */
export function useSyncRuntime(
  userId: string | null,
  transport: SyncTransport = httpSyncTransport,
) {
  const runtime = useMemo(() => {
    if (!userId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)) return null;
    const database = createUserSyncDatabase(userId);
    return { coordinator: new SyncCoordinator(database, transport), database };
  }, [transport, userId]);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [conflicts, setConflicts] = useState<LocalConflict[]>([]);
  const [pendingOperations, setPendingOperations] = useState<OutboxEntry[]>([]);

  useEffect(() => {
    if (!runtime) return;
    const refreshDetails = () => {
      void runtime.coordinator
        .listConflicts()
        .then(setConflicts)
        .catch(() => undefined);
      void runtime.database.outbox
        .toArray()
        .then(setPendingOperations)
        .catch(() => undefined);
    };
    const unsubscribe = runtime.coordinator.subscribe((next) => {
      setSnapshot(next);
      refreshDetails();
    });
    const removeTriggers = installSyncTriggers(runtime.coordinator);
    return () => {
      removeTriggers();
      unsubscribe();
      runtime.database.close();
    };
  }, [runtime]);

  return {
    database: runtime?.database,
    conflicts: runtime ? conflicts : [],
    pendingOperations: runtime ? pendingOperations : [],
    exportPending: async () => {
      if (!runtime) return;
      const content = await runtime.coordinator.exportPending();
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'torkout-pendencias.json';
      link.click();
      URL.revokeObjectURL(url);
    },
    resolve: async (id: string, choice: 'local' | 'server') => {
      if (!runtime) return;
      await runtime.coordinator.resolveConflict(id, choice);
      setConflicts(await runtime.coordinator.listConflicts());
    },
    retry: () => runtime?.coordinator.retryFailed(),
    snapshot: runtime ? snapshot : initialSnapshot,
    sync: () => runtime?.coordinator.sync(),
  };
}
