import { useId, useState } from 'react';

import { bodyRegionLabel, perceivedExertionLabel } from '../presentation';

type DiscomfortAnswer = 'joint' | 'muscular' | 'none' | 'other';

const ANSWERS: Array<{ label: string; value: DiscomfortAnswer }> = [
  { label: 'Não', value: 'none' },
  { label: 'Dor muscular', value: 'muscular' },
  { label: 'Dor articular', value: 'joint' },
  { label: 'Outro desconforto', value: 'other' },
];

const REGIONS = [
  'ankle',
  'foot',
  'knee',
  'leg',
  'thigh',
  'hip',
  'back',
  'abdomen',
  'chest',
  'shoulder',
  'arm',
  'elbow',
  'wrist',
  'hand',
  'neck',
  'other',
] as const;

export interface RecoveryReport {
  bodyRegion: string;
  customBodyRegion?: string;
  exerciseId?: string;
  exerciseStopped: boolean;
  intensityScore: number | null;
  localDate: string;
  moment: 'after' | 'during';
  notes?: string;
  supportDifficulty: boolean;
  swelling: boolean;
  type: 'joint' | 'muscular' | 'other';
}

export interface RecoverySubmission {
  perceivedExertion: number | null;
  recovery: { reports: RecoveryReport[]; status: 'none' | 'not_answered' | 'reported' };
}

interface RecoveryStepProps {
  exercises: Array<{ id: string; name: string }>;
  localDate: string;
  onSkip?(): void;
  onSubmit(input: RecoverySubmission): Promise<void> | void;
  sessionName: string;
}

/**
 * Etapa opcional exibida ao concluir o treino. Nunca bloqueia a conclusão, nunca altera o
 * planejamento e nunca emite diagnóstico.
 */
export function RecoveryStep({
  exercises,
  localDate,
  onSkip,
  onSubmit,
  sessionName,
}: RecoveryStepProps) {
  const groupName = useId();
  const [answer, setAnswer] = useState<DiscomfortAnswer | null>(null);
  const [bodyRegion, setBodyRegion] = useState<string>('ankle');
  const [customBodyRegion, setCustomBodyRegion] = useState('');
  const [intensity, setIntensity] = useState('');
  const [moment, setMoment] = useState<'after' | 'during'>('during');
  const [exerciseId, setExerciseId] = useState('');
  const [exerciseStopped, setExerciseStopped] = useState(false);
  const [swelling, setSwelling] = useState(false);
  const [supportDifficulty, setSupportDifficulty] = useState(false);
  const [notes, setNotes] = useState('');
  const [effort, setEffort] = useState('');

  const intensityScore = intensity === '' ? null : Number(intensity);
  const reported = answer !== null && answer !== 'none';
  const deservesAttention =
    reported &&
    (swelling ||
      supportDifficulty ||
      (answer === 'joint' && intensityScore !== null && intensityScore >= 7));

  function buildSubmission(): RecoverySubmission {
    const perceivedExertion = effort === '' ? null : Number(effort);
    if (answer === null) {
      return { perceivedExertion, recovery: { reports: [], status: 'not_answered' } };
    }
    if (answer === 'none') {
      return { perceivedExertion, recovery: { reports: [], status: 'none' } };
    }
    const report: RecoveryReport = {
      bodyRegion,
      exerciseStopped,
      intensityScore,
      localDate,
      moment,
      supportDifficulty,
      swelling,
      type: answer,
    };
    if (bodyRegion === 'other' && customBodyRegion.trim())
      report.customBodyRegion = customBodyRegion.trim();
    if (exerciseId) report.exerciseId = exerciseId;
    if (notes.trim()) report.notes = notes.trim();
    return { perceivedExertion, recovery: { reports: [report], status: 'reported' } };
  }

  return (
    <section className="card today-section recovery-step" aria-labelledby="recovery-heading">
      <h2 id="recovery-heading">Recuperação de {sessionName}</h2>
      <p className="field-hint">
        Esta etapa é rápida e opcional. Nada aqui altera o seu planejamento de treino.
      </p>

      <fieldset className="choice-group" role="radiogroup" aria-label="Dor ou desconforto">
        <legend>Sentiu alguma dor ou desconforto?</legend>
        {ANSWERS.map((option) => (
          <label className="inline-check" key={option.value}>
            <input
              checked={answer === option.value}
              name={groupName}
              type="radio"
              value={option.value}
              onChange={() => setAnswer(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      {reported && (
        <div className="recovery-details">
          <label>
            Região do corpo
            <select value={bodyRegion} onChange={(event) => setBodyRegion(event.target.value)}>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {bodyRegionLabel(region)}
                </option>
              ))}
            </select>
          </label>
          {bodyRegion === 'other' && (
            <label>
              Qual região
              <input
                value={customBodyRegion}
                onChange={(event) => setCustomBodyRegion(event.target.value)}
              />
            </label>
          )}
          <label>
            Intensidade de 0 a 10
            <input
              max="10"
              min="0"
              step="1"
              type="number"
              value={intensity}
              onChange={(event) => setIntensity(event.target.value)}
            />
          </label>
          <label>
            Quando ocorreu
            <select
              value={moment}
              onChange={(event) => setMoment(event.target.value as 'after' | 'during')}
            >
              <option value="during">Durante o exercício</option>
              <option value="after">Depois do exercício</option>
            </select>
          </label>
          <label>
            Exercício relacionado
            <select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)}>
              <option value="">Não informado</option>
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-check">
            <input
              checked={exerciseStopped}
              type="checkbox"
              onChange={(event) => setExerciseStopped(event.target.checked)}
            />
            Interrompi o exercício
          </label>
          <label className="inline-check">
            <input
              checked={swelling}
              type="checkbox"
              onChange={(event) => setSwelling(event.target.checked)}
            />
            Houve inchaço
          </label>
          <label className="inline-check">
            <input
              checked={supportDifficulty}
              type="checkbox"
              onChange={(event) => setSupportDifficulty(event.target.checked)}
            />
            Houve dificuldade para caminhar ou apoiar
          </label>
          <label>
            Observações do desconforto
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </div>
      )}

      {deservesAttention && (
        <p className="safety-note" role="status">
          Este registro merece atenção. Acompanhe como você se sente e, se quiser, leve estes dados
          a um profissional de saúde de sua confiança.
        </p>
      )}

      <label>
        Esforço percebido (0 a 10)
        <input
          max="10"
          min="0"
          step="1"
          type="range"
          value={effort === '' ? '0' : effort}
          onChange={(event) => setEffort(event.target.value)}
        />
        <span className="field-hint">
          {effort === ''
            ? 'Opcional. 0 nenhum esforço; 1–3 leve; 4–6 moderado; 7–8 difícil; 9 muito difícil; 10 esforço máximo.'
            : `${effort} · ${perceivedExertionLabel(Number(effort))}`}
        </span>
      </label>

      <div className="button-row">
        <button className="primary" type="button" onClick={() => void onSubmit(buildSubmission())}>
          Concluir treino
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip}>
            Voltar ao treino
          </button>
        )}
      </div>
    </section>
  );
}
