import { useEffect, useState } from 'react';

import type { AppApi, ProgressionSuggestionView } from '../auth-client';
import { evidenceLabel, progressionDecisionLabel, recordFieldValue } from '../presentation';

const TYPE_LABELS: Record<ProgressionSuggestionView['type'], string> = {
  increase: 'Aumentar',
  maintain: 'Manter',
  reduce: 'Reduzir',
  stop: 'Interromper',
};

export function ProgressionScreen({ api, onBack }: { api: AppApi; onBack(): void }) {
  const [items, setItems] = useState<ProgressionSuggestionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api
      .listProgressionSuggestions()
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch(() => {
        if (active)
          setError('Não foi possível carregar as sugestões. Reconecte e tente novamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function decide(
    item: ProgressionSuggestionView,
    decision: 'accepted' | 'ignored' | 'snoozed',
  ): Promise<void> {
    setBusyId(item.id);
    setError('');
    try {
      await api.decideProgression(item.id, decision);
      const status = decision;
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, status } : candidate,
        ),
      );
    } catch {
      setError('A decisão não foi salva. Nenhuma alteração foi aplicada.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="centered-layout progression-layout">
      <section className="card progression-card">
        <nav aria-label="Retorno" className="progression-toolbar">
          <button type="button" onClick={onBack}>
            Voltar
          </button>
        </nav>
        <p className="eyebrow">Progressão explicável</p>
        <h1>Sugestões</h1>
        <p>Você decide se e quando uma mudança será aplicada. Seu histórico nunca é reescrito.</p>
        {error && <p role="alert">{error}</p>}
        {loading ? (
          <p aria-busy="true">Carregando sugestões…</p>
        ) : items.length === 0 ? (
          <p>
            Ainda não há sugestões. Registre seus treinos e a informação de dor para gerar
            evidências.
          </p>
        ) : (
          <div className="progression-list">
            {items.map((item) => (
              <article className="progression-item" key={item.id}>
                <div className="progression-heading">
                  <h2>{item.exerciseName}</h2>
                  <span>{TYPE_LABELS[item.type]}</span>
                </div>
                <p>{item.explanation}</p>
                <p className="safety-notice">
                  <strong>Aviso de segurança:</strong> {item.safetyNotice}
                </p>
                <details>
                  <summary>Como esta sugestão foi calculada</summary>
                  <p>
                    Regra de progressão, versão {item.rule.version}. Evidências preservadas nesta
                    avaliação.
                  </p>
                  <EvidenceView evidence={item.evidence} />
                </details>
                {item.status === 'pending' ? (
                  <div
                    className="button-row"
                    aria-label={`Decidir sugestão para ${item.exerciseName}`}
                  >
                    <button
                      className="primary"
                      disabled={busyId === item.id}
                      type="button"
                      onClick={() => void decide(item, 'accepted')}
                    >
                      Aceitar
                    </button>
                    <button
                      disabled={busyId === item.id}
                      type="button"
                      onClick={() => void decide(item, 'snoozed')}
                    >
                      Adiar
                    </button>
                    <button
                      disabled={busyId === item.id}
                      type="button"
                      onClick={() => void decide(item, 'ignored')}
                    >
                      Ignorar
                    </button>
                  </div>
                ) : (
                  <p role="status">Decisão: {progressionDecisionLabel(item.status)}.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function EvidenceView({ evidence }: { evidence: unknown }) {
  if (!evidence || typeof evidence !== 'object')
    return <p>{String(evidence ?? 'Não informada')}</p>;
  const entries = Array.isArray(evidence)
    ? evidence.flatMap((item) =>
        item && typeof item === 'object' ? Object.entries(item as Record<string, unknown>) : [],
      )
    : Object.entries(evidence as Record<string, unknown>);
  return (
    <dl className="evidence-list">
      {entries.map(([key, value], index) => (
        <div key={`${key}-${index}`}>
          <dt>{evidenceLabel(key)}</dt>
          <dd>{recordFieldValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}
