import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  queueLocalMutation,
  type LocalRecord,
  type UserSyncDatabase,
} from '../sync/local-database';
import type { SyncState } from '../sync/sync-coordinator';

interface TodayScreenProps {
  database: UserSyncDatabase;
  now?: Date;
  onBack(): void;
  onImportHistory?(): Promise<void>;
  onSync(): void;
  syncState: SyncState;
  timeZone: string;
}

interface SetView {
  actualDistanceMeters?: number | null;
  actualDurationSeconds?: number | null;
  actualRepetitions?: number | null;
  completed: boolean;
  id: string;
  plannedDistanceMeters?: number | null;
  plannedDurationSeconds?: number | null;
  plannedRepetitions?: number | null;
  setNumber: number;
}

interface ExerciseView {
  id: string;
  name?: string;
  notes?: string | null;
  sets: SetView[];
  status: 'completed' | 'planned' | 'skipped' | 'stopped';
  trackingMetric?: 'distance' | 'duration' | 'repetitions';
}

interface ExecutionView {
  completedAt?: string | null;
  exercises: ExerciseView[];
  jointPainStatus: 'none' | 'reported' | 'unknown';
  startedAt?: string | null;
  walking?: {
    actualDistanceMeters?: number | null;
    distanceSource: 'gps' | 'import' | 'manual';
    durationSeconds?: number | null;
    notes?: string | null;
  } | null;
}

function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dataArray<T>(data: Record<string, unknown>, key: string): T[] {
  return Array.isArray(data[key]) ? (data[key] as T[]) : [];
}

function executionOf(record: LocalRecord): ExecutionView {
  const stored = record.data.execution as ExecutionView | undefined;
  if (stored) return structuredClone(stored);
  const exercises = dataArray<ExerciseView>(record.data, 'exercises').map((exercise) => ({
    id: exercise.id,
    notes: exercise.notes ?? null,
    sets: exercise.sets.map((set) => ({
      actualDistanceMeters: set.actualDistanceMeters ?? null,
      actualDurationSeconds: set.actualDurationSeconds ?? null,
      actualRepetitions: set.actualRepetitions ?? null,
      completed: set.completed,
      id: set.id,
      setNumber: set.setNumber,
    })),
    status: exercise.status,
  }));
  return {
    exercises,
    jointPainStatus:
      record.data.jointPainStatus === 'none' || record.data.jointPainStatus === 'reported'
        ? record.data.jointPainStatus
        : 'unknown',
    walking: (record.data.walking as ExecutionView['walking']) ?? null,
  };
}

function stringValue(data: Record<string, unknown>, key: string, fallback = ''): string {
  return typeof data[key] === 'string' ? data[key] : fallback;
}

const syncMessages: Record<SyncState, string> = {
  'auth-required': 'Autenticação necessária; alterações preservadas.',
  conflict: 'Há um conflito que precisa da sua decisão.',
  error: 'Falha de conexão; nada foi perdido.',
  offline: 'Salvo localmente. Sincronização aguardando conexão.',
  pending: 'Salvo localmente e pendente de sincronização.',
  synced: 'Sincronizado.',
  syncing: 'Sincronizando…',
};

export function TodayScreen({
  database,
  now = new Date(),
  onBack,
  onImportHistory,
  onSync,
  syncState,
  timeZone,
}: TodayScreenProps) {
  const date = localDate(now, timeZone);
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [message, setMessage] = useState(syncMessages[syncState]);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [painType, setPainType] = useState<'joint' | 'muscular'>('muscular');
  const [painIntensity, setPainIntensity] = useState('not_informed');
  const [painRegion, setPainRegion] = useState('other');
  const [painCustomRegion, setPainCustomRegion] = useState('');
  const [painMoment, setPainMoment] = useState('after');
  const [painNotes, setPainNotes] = useState('');

  async function refresh(): Promise<void> {
    setRecords(await database.records.toArray());
  }

  useEffect(() => {
    let active = true;
    void database.records.toArray().then((items) => {
      if (active) setRecords(items);
    });
    return () => {
      active = false;
    };
  }, [database]);

  const sessions = useMemo(
    () =>
      records.filter(
        (record) =>
          record.entityType === 'workout_session' &&
          record.deletedAt === null &&
          record.data.plannedLocalDate === date,
      ),
    [date, records],
  );
  const habits = records.filter(
    (record) =>
      record.entityType === 'habit_definition' &&
      record.deletedAt === null &&
      record.data.active !== false,
  );

  async function saveExecution(
    session: LocalRecord,
    change: (execution: ExecutionView) => void,
  ): Promise<void> {
    const execution = executionOf(session);
    change(execution);
    setRecords((current) =>
      current.map((record) =>
        record.key === session.key
          ? { ...record, data: { ...record.data, execution }, syncStatus: 'pending' }
          : record,
      ),
    );
    await queueLocalMutation(database, {
      entityId: session.entityId,
      entityType: 'workout_session',
      operation: 'update',
      payload: { execution },
    });
    setMessage('Salvo localmente e pendente de sincronização.');
    await refresh();
  }

  function namedExercises(session: LocalRecord): ExerciseView[] {
    const planned = dataArray<ExerciseView>(session.data, 'exercises');
    const execution = executionOf(session);
    return execution.exercises.map((exercise) => ({
      ...exercise,
      name: planned.find((candidate) => candidate.id === exercise.id)?.name ?? 'Exercício',
      trackingMetric:
        planned.find((candidate) => candidate.id === exercise.id)?.trackingMetric ?? 'repetitions',
    }));
  }

  async function saveSet(
    session: LocalRecord,
    exerciseId: string,
    setId: string,
    metric: NonNullable<ExerciseView['trackingMetric']>,
    rawValue: string,
  ): Promise<void> {
    await saveExecution(session, (execution) => {
      const set = execution.exercises
        .find((exercise) => exercise.id === exerciseId)
        ?.sets.find((candidate) => candidate.id === setId);
      if (!set) return;
      const value = rawValue === '' ? null : Number(rawValue);
      set.actualDistanceMeters = metric === 'distance' ? value : null;
      set.actualDurationSeconds = metric === 'duration' ? value : null;
      set.actualRepetitions = metric === 'repetitions' ? value : null;
      set.completed = value !== null;
    });
  }

  async function addSet(session: LocalRecord, exerciseId: string): Promise<void> {
    await saveExecution(session, (execution) => {
      const exercise = execution.exercises.find((candidate) => candidate.id === exerciseId);
      if (!exercise) return;
      exercise.sets.push({
        actualDistanceMeters: null,
        actualDurationSeconds: null,
        actualRepetitions: null,
        completed: false,
        id: crypto.randomUUID(),
        setNumber: Math.max(0, ...exercise.sets.map((set) => set.setNumber)) + 1,
      });
    });
  }

  async function saveHabit(
    definition: LocalRecord,
    value: {
      booleanValue?: boolean;
      numericValue?: number;
      selectedOptionId?: string;
    },
  ): Promise<void> {
    const existing = records.find(
      (record) =>
        record.entityType === 'habit_entry' &&
        record.data.habitDefinitionId === definition.entityId &&
        record.data.localDate === date,
    );
    await queueLocalMutation(database, {
      entityId: existing?.entityId ?? crypto.randomUUID(),
      entityType: 'habit_entry',
      operation: existing ? 'update' : 'create',
      payload: existing
        ? value
        : { habitDefinitionId: definition.entityId, localDate: date, ...value },
    });
    setMessage('Salvo localmente: hábito pendente de sincronização.');
    await refresh();
  }

  async function saveMeasurement(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!weight && !waist) return;
    await queueLocalMutation(database, {
      entityId: crypto.randomUUID(),
      entityType: 'body_measurement',
      operation: 'create',
      payload: {
        localDate: date,
        measuredAt: now.toISOString(),
        notes: painNotes || null,
        waistCm: waist ? Number(waist) : null,
        weightKg: weight ? Number(weight) : null,
      },
    });
    setWeight('');
    setWaist('');
    setMessage('Salvo localmente: medida pendente de sincronização.');
    await refresh();
  }

  async function savePain(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await queueLocalMutation(database, {
      entityId: crypto.randomUUID(),
      entityType: 'pain_report',
      operation: 'create',
      payload: {
        bodyRegion: painRegion,
        customBodyRegion: painRegion === 'other' ? painCustomRegion : null,
        exerciseStopped: false,
        intensity: painIntensity,
        localDate: date,
        moment: painMoment,
        notes: null,
        occurredAt: now.toISOString(),
        type: painType,
      },
    });
    setMessage('Salvo localmente: relato de dor pendente de sincronização.');
    setPainNotes('');
    await refresh();
  }

  return (
    <main className="today-layout">
      <header className="planning-header">
        <div>
          <p className="eyebrow">Registro diário</p>
          <h1>Hoje</h1>
          <p>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone }).format(now)}</p>
        </div>
        <button type="button" onClick={onBack}>
          Voltar
        </button>
      </header>

      <p className="sync-note" role="status">
        {message}
      </p>

      <section className="card today-section" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">Sessões</h2>
        {sessions.length === 0 && <p>Nenhuma sessão planejada para hoje.</p>}
        {sessions.map((session) => (
          <article className="today-session" key={session.entityId}>
            <h3>{stringValue(session.data, 'templateNameSnapshot', 'Sessão')}</h3>
            <p>
              {stringValue(session.data, 'type', 'other')} ·{' '}
              {stringValue(session.data, 'status', 'planned')}
            </p>
            <label>
              Observações da sessão
              <textarea
                defaultValue={stringValue(session.data, 'notes')}
                onBlur={(event) =>
                  void queueLocalMutation(database, {
                    entityId: session.entityId,
                    entityType: 'workout_session',
                    operation: 'update',
                    payload: { notes: event.target.value || null },
                  }).then(refresh)
                }
              />
            </label>
            {namedExercises(session).map((exercise) => (
              <fieldset key={exercise.id}>
                <legend>{exercise.name}</legend>
                {exercise.sets.map((set) => {
                  const metric = exercise.trackingMetric ?? 'repetitions';
                  const actual =
                    metric === 'distance'
                      ? set.actualDistanceMeters
                      : metric === 'duration'
                        ? set.actualDurationSeconds
                        : set.actualRepetitions;
                  const planned = dataArray<ExerciseView>(session.data, 'exercises')
                    .find((item) => item.id === exercise.id)
                    ?.sets.find((item) => item.id === set.id)?.[
                    metric === 'distance'
                      ? 'plannedDistanceMeters'
                      : metric === 'duration'
                        ? 'plannedDurationSeconds'
                        : 'plannedRepetitions'
                  ];
                  return (
                    <label key={set.id}>
                      Série {set.setNumber} de {exercise.name}
                      <span className="field-hint">Meta: {planned ?? 'série adicional'}</span>
                      <input
                        aria-label={`Série ${set.setNumber} de ${exercise.name}`}
                        min="0"
                        type="number"
                        value={actual ?? ''}
                        onChange={(event) =>
                          void saveSet(session, exercise.id, set.id, metric, event.target.value)
                        }
                      />
                    </label>
                  );
                })}
                <div className="button-row">
                  <button type="button" onClick={() => void addSet(session, exercise.id)}>
                    Adicionar série em {exercise.name}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void saveExecution(session, (execution) => {
                        const item = execution.exercises.find(
                          (candidate) => candidate.id === exercise.id,
                        );
                        if (item) item.status = 'skipped';
                      })
                    }
                  >
                    Ignorar {exercise.name}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void saveExecution(session, (execution) => {
                        const item = execution.exercises.find(
                          (candidate) => candidate.id === exercise.id,
                        );
                        if (item) item.status = 'stopped';
                      })
                    }
                  >
                    Interromper {exercise.name}
                  </button>
                </div>
                <label>
                  Observações de {exercise.name}
                  <textarea
                    value={exercise.notes ?? ''}
                    onChange={(event) =>
                      void saveExecution(session, (execution) => {
                        const item = execution.exercises.find(
                          (candidate) => candidate.id === exercise.id,
                        );
                        if (item) item.notes = event.target.value || null;
                      })
                    }
                  />
                </label>
              </fieldset>
            ))}
            {session.data.type === 'walk' && (
              <fieldset>
                <legend>Detalhes da caminhada</legend>
                <label>
                  Distância realizada (m)
                  <input
                    min="0"
                    type="number"
                    onChange={(event) =>
                      void saveExecution(session, (execution) => {
                        execution.walking = {
                          ...execution.walking,
                          actualDistanceMeters: Number(event.target.value),
                          distanceSource: 'manual',
                        };
                      })
                    }
                  />
                </label>
                <label>
                  Duração da caminhada (segundos)
                  <input
                    min="0"
                    type="number"
                    onChange={(event) =>
                      void saveExecution(session, (execution) => {
                        execution.walking = {
                          ...execution.walking,
                          distanceSource: 'manual',
                          durationSeconds: Number(event.target.value),
                        };
                      })
                    }
                  />
                </label>
                <label>
                  Observações da caminhada
                  <textarea
                    onChange={(event) =>
                      void saveExecution(session, (execution) => {
                        execution.walking = {
                          ...execution.walking,
                          distanceSource: 'manual',
                          notes: event.target.value || null,
                        };
                      })
                    }
                  />
                </label>
              </fieldset>
            )}
            <fieldset>
              <legend>Dor articular</legend>
              <label className="inline-check">
                <input
                  checked={executionOf(session).jointPainStatus === 'none'}
                  type="checkbox"
                  onChange={(event) =>
                    void saveExecution(session, (execution) => {
                      execution.jointPainStatus = event.target.checked ? 'none' : 'unknown';
                    })
                  }
                />
                Confirmo que não houve dor articular
              </label>
              {executionOf(session).jointPainStatus === 'unknown' && (
                <p>A ausência ainda não foi confirmada e permanece desconhecida.</p>
              )}
            </fieldset>
            <button
              className="primary"
              type="button"
              onClick={() =>
                void saveExecution(session, (execution) => {
                  execution.exercises.forEach((exercise) => {
                    if (exercise.status === 'skipped' || exercise.status === 'stopped') return;
                    exercise.status = exercise.sets.every((set) => set.completed)
                      ? 'completed'
                      : 'stopped';
                  });
                  execution.completedAt = new Date().toISOString();
                })
              }
            >
              Finalizar {stringValue(session.data, 'templateNameSnapshot', 'sessão')}
            </button>
          </article>
        ))}
      </section>

      <section className="card today-section" aria-labelledby="habits-heading">
        <h2 id="habits-heading">Hábitos do dia</h2>
        {habits.length === 0 && <p>Nenhum hábito ativo.</p>}
        {habits.map((habit) => {
          const options = dataArray<{ id: string; label: string }>(habit.data, 'options');
          const entry = records.find(
            (record) =>
              record.entityType === 'habit_entry' &&
              record.data.habitDefinitionId === habit.entityId &&
              record.data.localDate === date,
          );
          const name = stringValue(habit.data, 'name', 'Hábito');
          const type = stringValue(habit.data, 'type', 'choice');
          if (type === 'boolean') {
            return (
              <label className="inline-check" key={habit.entityId}>
                <input
                  checked={entry?.data.booleanValue === true}
                  type="checkbox"
                  onChange={(event) =>
                    void saveHabit(habit, { booleanValue: event.target.checked })
                  }
                />
                {name}
              </label>
            );
          }
          if (type === 'quantity' || type === 'scale') {
            return (
              <label key={habit.entityId}>
                {name}
                <input
                  min="0"
                  type="number"
                  value={
                    typeof entry?.data.numericValue === 'number' ? entry.data.numericValue : ''
                  }
                  onChange={(event) =>
                    void saveHabit(habit, { numericValue: Number(event.target.value) })
                  }
                />
              </label>
            );
          }
          return (
            <label key={habit.entityId}>
              {name}
              <select
                value={stringValue(entry?.data ?? {}, 'selectedOptionId')}
                onChange={(event) =>
                  void saveHabit(habit, { selectedOptionId: event.target.value })
                }
              >
                <option value="">Não informado</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </section>

      <section className="card today-section" aria-labelledby="pain-heading">
        <h2 id="pain-heading">Dor</h2>
        <form onSubmit={(event) => void savePain(event)}>
          <label>
            Tipo de dor
            <select
              value={painType}
              onChange={(event) => setPainType(event.target.value as typeof painType)}
            >
              <option value="muscular">Muscular</option>
              <option value="joint">Articular</option>
            </select>
          </label>
          <label>
            Intensidade
            <select
              value={painIntensity}
              onChange={(event) => setPainIntensity(event.target.value)}
            >
              <option value="not_informed">Não informada</option>
              <option value="light">Leve</option>
              <option value="moderate">Moderada</option>
              <option value="strong">Forte</option>
            </select>
          </label>
          <label>
            Momento
            <select value={painMoment} onChange={(event) => setPainMoment(event.target.value)}>
              <option value="before">Antes</option>
              <option value="during">Durante</option>
              <option value="after">Imediatamente depois</option>
              <option value="next_day">Dia seguinte</option>
            </select>
          </label>
          <label>
            Região
            <select value={painRegion} onChange={(event) => setPainRegion(event.target.value)}>
              <option value="ankle">Tornozelo</option>
              <option value="foot">Pé</option>
              <option value="knee">Joelho</option>
              <option value="other">Outra</option>
            </select>
          </label>
          {painRegion === 'other' && (
            <label>
              Outra região
              <input
                required
                value={painCustomRegion}
                onChange={(event) => setPainCustomRegion(event.target.value)}
              />
            </label>
          )}
          {painType === 'joint' && painMoment === 'during' && (
            <p className="safety-note" role="alert">
              Considere interromper o exercício e registre o ocorrido. Isto não é diagnóstico.
            </p>
          )}
          <label>
            Observações da dor
            <textarea value={painNotes} onChange={(event) => setPainNotes(event.target.value)} />
          </label>
          <button type="submit">Registrar dor</button>
        </form>
      </section>

      <section className="card today-section" aria-labelledby="measurements-heading">
        <h2 id="measurements-heading">Peso e cintura</h2>
        <form onSubmit={(event) => void saveMeasurement(event)}>
          <label>
            Peso (kg)
            <input
              min="0.1"
              step="0.1"
              type="number"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
            />
          </label>
          <label>
            Cintura (cm)
            <input
              min="0.1"
              step="0.1"
              type="number"
              value={waist}
              onChange={(event) => setWaist(event.target.value)}
            />
          </label>
          <button type="submit">Salvar medida</button>
        </form>
      </section>

      {onImportHistory && (
        <button type="button" onClick={() => void onImportHistory()}>
          Importar histórico de 13/07/2026
        </button>
      )}
      <button className="primary sticky-action" type="button" onClick={onSync}>
        Sincronizar agora
      </button>
    </main>
  );
}
