import type { LocalConflict } from '../sync/local-database';
import type { OutboxEntry } from '../sync/local-database';
import type { SyncState } from '../sync/sync-coordinator';

const labels: Record<SyncState, string> = {
  'auth-required': 'Reconecte e entre novamente para enviar suas alterações.',
  conflict: 'Há conflitos que precisam da sua decisão.',
  error: 'A sincronização falhou. Suas alterações continuam neste dispositivo.',
  offline: 'Salvo localmente. Aguardando conexão.',
  pending: 'Alterações salvas localmente e pendentes de envio.',
  synced: 'Tudo sincronizado.',
  syncing: 'Sincronizando…',
};

interface SyncPanelProps {
  conflicts: Array<Omit<LocalConflict, 'operationId'>>;
  onExport(): void;
  onResolve(id: string, choice: 'local' | 'server'): void;
  onRetry(): void;
  onSync(): void;
  pendingCount: number;
  pendingOperations?: OutboxEntry[];
  state: SyncState;
}

export function SyncPanel(props: SyncPanelProps) {
  return (
    <section className="sync-panel" aria-labelledby="sync-title">
      <h2 id="sync-title">Sincronização</h2>
      <p role="status">
        {props.pendingCount}{' '}
        {props.pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'}.{' '}
        {labels[props.state]}
      </p>
      <div className="link-actions">
        <button type="button" onClick={props.onSync}>
          Sincronizar agora
        </button>
        <button type="button" onClick={props.onRetry}>
          Tentar pendências novamente
        </button>
        <button type="button" onClick={props.onExport}>
          Exportar pendências
        </button>
      </div>
      {(props.pendingOperations?.length ?? 0) > 0 && (
        <details>
          <summary>Inspecionar pendências</summary>
          <ul className="sync-operation-list">
            {props.pendingOperations?.map((operation) => (
              <li key={operation.operationId}>
                {operation.entityType} · {operation.operation} · {operation.state}
                {operation.lastError ? ` · ${operation.lastError}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
      {props.conflicts.map((conflict) => (
        <article className="sync-conflict" key={conflict.id}>
          <h3>Conflito em {conflict.entityType}</h3>
          <p>Versão local: {JSON.stringify(conflict.localPayload)}</p>
          <p>Versão do servidor: {JSON.stringify(conflict.serverRecord)}</p>
          <div className="link-actions">
            <button type="button" onClick={() => props.onResolve(conflict.id, 'local')}>
              Usar versão local
            </button>
            <button type="button" onClick={() => props.onResolve(conflict.id, 'server')}>
              Usar versão do servidor
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
