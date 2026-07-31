import Dexie from 'dexie';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import type { LocalRecord, UserSyncDatabase } from './local-database';

/**
 * Observa a réplica local em vez de tirar uma fotografia dela na montagem da tela. Qualquer escrita
 * — desta tela, de outro componente ou do sincronizador — chega sozinha à interface, sem depender de
 * sair da página e voltar. O `setRecords` continua exposto para atualização otimista enquanto a
 * gravação no IndexedDB não conclui.
 *
 * A releitura é disparada pelo evento global de mutação do Dexie e não pelo `liveQuery`, para que a
 * falha de uma consulta interrompida pelo fechamento da réplica (logout, troca de conta) seja
 * tratada aqui e não escape como rejeição sem dono.
 */
export function useLocalRecords(
  database: UserSyncDatabase,
): [LocalRecord[], Dispatch<SetStateAction<LocalRecord[]>>] {
  const [records, setRecords] = useState<LocalRecord[]>([]);

  useEffect(() => {
    let active = true;
    const reload = () => {
      if (!active || !database.isOpen()) return;
      database.records
        .toArray()
        .catch('DatabaseClosedError', () => null)
        .catch(() => null)
        .then((items) => {
          if (active && items) setRecords(items);
        });
    };
    // A releitura sai da zona de transação do Dexie antes de consultar: uma consulta iniciada dentro
    // do evento fica presa ao contexto da escrita e, se a réplica fechar, rejeita sem dono.
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (scheduled !== null) return;
      scheduled = setTimeout(() => {
        scheduled = null;
        reload();
      }, 0);
    };
    reload();
    Dexie.on('storagemutated', scheduleReload);
    return () => {
      active = false;
      if (scheduled !== null) clearTimeout(scheduled);
      Dexie.on('storagemutated').unsubscribe(scheduleReload);
    };
  }, [database]);

  return [records, setRecords];
}
