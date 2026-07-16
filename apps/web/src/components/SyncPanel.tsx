import type { LocalConflict } from '../sync/local-database';
import type { OutboxEntry } from '../sync/local-database';
import type { SyncState } from '../sync/sync-coordinator';
import {
  recordFieldLabel,
  recordFieldValue,
  syncEntityLabel,
  syncOperationLabel,
  syncOperationStateLabel,
} from '../presentation';

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
                {syncEntityLabel(operation.entityType)} · {syncOperationLabel(operation.operation)}{' '}
                · {syncOperationStateLabel(operation.state)}
                {operation.lastError ? ' · Não foi possível enviar; tente novamente.' : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
      {props.conflicts.map((conflict) => (
        <article className="sync-conflict" key={conflict.id}>
          <h3>{syncEntityLabel(conflict.entityType)}</h3>
          <ConflictVersion label="Sua versão" record={conflict.localPayload} />
          <ConflictVersion label="Versão recebida" record={conflict.serverRecord} />
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

function ConflictVersion({ label, record }: { label: string; record: unknown }) {
  const entries =
    record && typeof record === 'object'
      ? Object.entries(record as Record<string, unknown>).filter(([key]) => key !== 'version')
      : [];
  return (
    <section className="sync-conflict__version" aria-label={label}>
      <h4>{label}</h4>
      {entries.length === 0 ? (
        <p>Informação preservada.</p>
      ) : (
        <dl>
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{recordFieldLabel(key)}</dt>
              <dd>{recordFieldValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
