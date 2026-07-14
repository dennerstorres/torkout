import { type FormEvent, useState } from 'react';

import type { PrivacyDocumentView } from '../auth-client';

interface Props {
  documents: PrivacyDocumentView[];
  onComplete(profile: Record<string, unknown>, versions: Record<string, string>): Promise<void>;
}

export function OnboardingScreen({ documents, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => {
      const value = String(data.get(name) ?? '');
      return value ? Number(value) : undefined;
    };
    const habits = ['coffee', 'rice', 'protein', 'salad'].filter((habit) => data.has(habit));
    try {
      await onComplete(
        {
          displayName: String(data.get('displayName') ?? ''),
          enabledInitialHabits: habits,
          heightCm: optionalNumber('heightCm'),
          initialWaistCm: optionalNumber('initialWaistCm'),
          initialWeightKg: optionalNumber('initialWeightKg'),
          locale: 'pt-BR',
          nonMedicalDisclaimerAccepted: data.has('disclaimer'),
          preferredWorkoutTime: String(data.get('preferredWorkoutTime') ?? '') || null,
          timeZone: String(data.get('timeZone') ?? 'America/Cuiaba'),
          unitSystem: 'metric',
        },
        Object.fromEntries(documents.map((document) => [document.type, document.version])),
      );
    } catch {
      setError('Não foi possível salvar sua configuração. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="centered-layout">
      <section className="card wide-card">
        <p className="eyebrow">Primeiro acesso</p>
        <h1>Configure seu perfil</h1>
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <label>
              Nome de exibição
              <input name="displayName" required />
            </label>
            <label>
              Altura (cm)
              <input max="300" min="1" name="heightCm" required type="number" />
            </label>
            <label>
              Peso inicial (kg), opcional
              <input min="1" name="initialWeightKg" step="0.1" type="number" />
            </label>
            <label>
              Cintura inicial (cm), opcional
              <input min="1" name="initialWaistCm" step="0.1" type="number" />
            </label>
            <label>
              Fuso horário
              <input name="timeZone" defaultValue="America/Cuiaba" required />
            </label>
            <label>
              Horário preferencial
              <input name="preferredWorkoutTime" type="time" />
            </label>
          </div>
          <fieldset>
            <legend>Hábitos que deseja acompanhar</legend>
            <div className="check-grid">
              <label>
                <input name="coffee" type="checkbox" /> Café
              </label>
              <label>
                <input name="rice" type="checkbox" /> Arroz
              </label>
              <label>
                <input name="protein" type="checkbox" /> Proteína
              </label>
              <label>
                <input name="salad" type="checkbox" /> Salada
              </label>
            </div>
          </fieldset>
          <div className="documents">
            {documents.map((document) => (
              <details key={document.type}>
                <summary>
                  {document.title} — versão {document.version}
                </summary>
                <p>{document.content}</p>
              </details>
            ))}
          </div>
          <label className="check-row">
            <input name="privacy" required type="checkbox" />
            Li e aceito os documentos de privacidade, termos e dados de saúde.
          </label>
          <label className="check-row">
            <input name="disclaimer" required type="checkbox" />
            Entendo que as sugestões não substituem avaliação ou orientação médica.
          </label>
          <button className="primary" disabled={busy} type="submit">
            Concluir configuração
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
