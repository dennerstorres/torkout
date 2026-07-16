import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { activityTypeLabel, sessionStatusLabel } from '../presentation';
import {
  queueLocalMutation,
  type LocalRecord,
  type UserSyncDatabase,
} from '../sync/local-database';
import type { SyncState } from '../sync/sync-coordinator';
import { EmptyState, MetricCard, ProgressBar, StatusBadge } from './ui';

interface TodayScreenProps {
  database: UserSyncDatabase;
  name?: string;
  now?: Date;
  onBack(): void;
  onPlan?(): void;
  onSync(): void;
  syncState: SyncState;
  timeZone: string;
}

const BODY_MEASUREMENT_OPTIONS = [
  { key: 'abdomen', label: 'Abdômen' },
  { key: 'biceps', label: 'Bíceps' },
  { key: 'thigh', label: 'Coxa' },
  { key: 'hips', label: 'Quadril/glúteos' },
  { key: 'neck', label: 'Pescoço' },
  { key: 'chest', label: 'Peito' },
  { key: 'calf', label: 'Panturrilha' },
  { key: 'custom', label: 'Outra medida' },
] as const;

interface AdditionalMeasurementDraft {
  key: string;
  customLabel: string;
  unit: string;
  value: string;
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
  name,
  now = new Date(),
  onBack,
  onPlan,
  onSync,
  syncState,
  timeZone,
}: TodayScreenProps) {
  const date = localDate(now, timeZone);
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [message, setMessage] = useState(syncMessages[syncState]);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [measurementDate, setMeasurementDate] = useState(date);
  const [additionalMeasurements, setAdditionalMeasurements] = useState<
    AdditionalMeasurementDraft[]
  >([]);
  const [painType, setPainType] = useState<'joint' | 'muscular'>('muscular');
  const [painIntensity, setPainIntensity] = useState('not_informed');
  const [painRegion, setPainRegion] = useState('other');
  const [painCustomRegion, setPainCustomRegion] = useState('');
  const [painMoment, setPainMoment] = useState('after');
  const [painNotes, setPainNotes] = useState('');
  const [runnerSessionId, setRunnerSessionId] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setRecords(await database.records.toArray());
  }

  useEffect(() => {
    let active = true;
    void database.records
      .toArray()
      .then((items) => {
        if (active) setRecords(items);
      })
      .catch(() => undefined);
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
  const weekStart = new Date(`${date}T12:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
  const weekThrough = new Date(weekStart);
  weekThrough.setUTCDate(weekThrough.getUTCDate() + 6);
  const weeklySessions = records.filter(
    (record) =>
      record.entityType === 'workout_session' &&
      record.deletedAt === null &&
      typeof record.data.plannedLocalDate === 'string' &&
      record.data.plannedLocalDate >= weekStart.toISOString().slice(0, 10) &&
      record.data.plannedLocalDate <= weekThrough.toISOString().slice(0, 10),
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
    const extra = additionalMeasurements
      .filter((measurement) => measurement.value)
      .map((measurement) => {
        const preset = BODY_MEASUREMENT_OPTIONS.find((option) => option.key === measurement.key);
        return {
          key:
            measurement.key === 'custom'
              ? measurement.customLabel.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, '_')
              : measurement.key,
          label:
            measurement.key === 'custom'
              ? measurement.customLabel.trim()
              : (preset?.label ?? measurement.key),
          unit: measurement.unit,
          value: Number(measurement.value),
        };
      });
    if (!weight && !waist && extra.length === 0) return;
    await queueLocalMutation(database, {
      entityId: crypto.randomUUID(),
      entityType: 'body_measurement',
      operation: 'create',
      payload: {
        additionalMeasurements: extra,
        localDate: measurementDate,
        measuredAt: now.toISOString(),
        notes: painNotes || null,
        waistCm: waist ? Number(waist) : null,
        weightKg: weight ? Number(weight) : null,
      },
    });
    setWeight('');
    setWaist('');
    setAdditionalMeasurements([]);
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

  async function finishSession(
    session: LocalRecord,
    forcedStatus?: 'cancelled' | 'missed',
  ): Promise<void> {
    const execution = executionOf(session);
    execution.exercises.forEach((exercise) => {
      if (exercise.status === 'skipped' || exercise.status === 'stopped') return;
      exercise.status = exercise.sets.every((set) => set.completed) ? 'completed' : 'stopped';
    });
    execution.completedAt = forcedStatus ? null : new Date().toISOString();
    const complete = execution.exercises.every(
      (exercise) => exercise.status === 'completed' && exercise.sets.every((set) => set.completed),
    );
    await queueLocalMutation(database, {
      entityId: session.entityId,
      entityType: 'workout_session',
      operation: 'update',
      payload: { execution, status: forcedStatus ?? (complete ? 'completed' : 'partial') },
    });
    setMessage('Treino salvo localmente e pendente de sincronização.');
    setRunnerSessionId(null);
    await refresh();
  }

  return (
    <main className="today-layout">
      <header className="planning-header">
        <div>
          <p className="eyebrow">Seu ritmo, hoje</p>
          <h1>Hoje</h1>
          {name && <p className="today-greeting">Olá, {name}.</p>}
          <p>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeZone }).format(now)}</p>
        </div>
        <button type="button" onClick={onBack}>
          Voltar
        </button>
      </header>

      <p className="sync-note" role="status">
        {message}
      </p>

      <section className="card today-section sessions-section" aria-labelledby="sessions-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Treino principal</p>
            <h2 id="sessions-heading">
              {runnerSessionId ? 'Treino em execução' : 'Sessões de hoje'}
            </h2>
          </div>
          {runnerSessionId && (
            <button type="button" onClick={() => setRunnerSessionId(null)}>
              Voltar ao resumo
            </button>
          )}
        </div>
        {sessions.length === 0 && (
          <EmptyState
            title="Hoje está livre"
            action={
              onPlan ? (
                <button className="primary" type="button" onClick={onPlan}>
                  Planejar treino
                </button>
              ) : undefined
            }
          >
            Planeje sua próxima sessão ou aproveite o descanso previsto.
          </EmptyState>
        )}
        {sessions
          .filter((session) => runnerSessionId === null || runnerSessionId === session.entityId)
          .map((session) => {
            if (runnerSessionId === null && session.data.type === 'rest') {
              return (
                <div className="rest-session" key={session.entityId}>
                  <div>
                    <h3>Dia de recuperação</h3>
                    <p>Seu descanso está planejado. Retome quando fizer sentido para você.</p>
                  </div>
                  {onPlan && (
                    <button className="primary" type="button" onClick={onPlan}>
                      Planejar outro treino
                    </button>
                  )}
                </div>
              );
            }
            return (
              <article
                className={`today-session ${runnerSessionId ? 'today-session--runner' : ''}`.trim()}
                key={session.entityId}
              >
                <div className="session-title">
                  <div>
                    <h3>{stringValue(session.data, 'templateNameSnapshot', 'Sessão')}</h3>
                    <p>
                      {activityTypeLabel(stringValue(session.data, 'type', 'other'))} ·{' '}
                      {sessionStatusLabel(stringValue(session.data, 'status', 'planned'))}
                    </p>
                  </div>
                  <StatusBadge tone={session.syncStatus === 'synced' ? 'success' : 'warning'}>
                    {session.syncStatus === 'synced' ? 'Sincronizado' : 'Salvo localmente'}
                  </StatusBadge>
                </div>
                {runnerSessionId === null ? (
                  <button
                    className="primary start-workout"
                    type="button"
                    onClick={() => setRunnerSessionId(session.entityId)}
                  >
                    Iniciar {stringValue(session.data, 'templateNameSnapshot', 'sessão')}
                  </button>
                ) : (
                  <>
                    <ProgressBar
                      label="Progresso do treino"
                      value={workoutProgress(executionOf(session))}
                    />
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
                              <span className="field-hint">
                                Meta: {planned ?? 'série adicional'}
                              </span>
                              <input
                                aria-label={`Série ${set.setNumber} de ${exercise.name}`}
                                min="0"
                                type="number"
                                value={actual ?? ''}
                                onChange={(event) =>
                                  void saveSet(
                                    session,
                                    exercise.id,
                                    set.id,
                                    metric,
                                    event.target.value,
                                  )
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
                      onClick={() => void finishSession(session)}
                    >
                      Finalizar {stringValue(session.data, 'templateNameSnapshot', 'sessão')}
                    </button>
                    <div className="button-row" aria-label="Outras formas de encerrar o treino">
                      <button type="button" onClick={() => void finishSession(session, 'missed')}>
                        Marcar como perdido
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => void finishSession(session, 'cancelled')}
                      >
                        Cancelar treino
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
      </section>

      {runnerSessionId === null && (
        <section className="today-summary" aria-label="Resumo de hoje">
          <MetricCard label="Treinos na semana" value={weeklySessions.length} />
          <MetricCard label="Hábitos" value={habits.length} />
          <MetricCard
            label="Pendências locais"
            value={records.filter((record) => record.syncStatus === 'pending').length}
          />
        </section>
      )}

      {runnerSessionId === null && (
        <section className="today-complementary-grid" aria-label="Registros complementares">
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

          <details className="secondary-disclosure">
            <summary>
              <span>
                <strong>Dor e desconforto</strong>
                <small>Registre somente quando precisar</small>
              </span>
            </summary>
            <section className="today-section" aria-labelledby="pain-heading">
              <h2 id="pain-heading">Registrar dor</h2>
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
                  <select
                    value={painMoment}
                    onChange={(event) => setPainMoment(event.target.value)}
                  >
                    <option value="before">Antes</option>
                    <option value="during">Durante</option>
                    <option value="after">Imediatamente depois</option>
                    <option value="next_day">Dia seguinte</option>
                  </select>
                </label>
                <label>
                  Região
                  <select
                    value={painRegion}
                    onChange={(event) => setPainRegion(event.target.value)}
                  >
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
                  <textarea
                    value={painNotes}
                    onChange={(event) => setPainNotes(event.target.value)}
                  />
                </label>
                <button type="submit">Registrar dor</button>
              </form>
            </section>
          </details>

          <details className="secondary-disclosure">
            <summary>
              <span>
                <strong>Peso e cintura</strong>
                <small>Adicione uma medição quando quiser</small>
              </span>
            </summary>
            <section className="today-section" aria-labelledby="measurements-heading">
              <h2 id="measurements-heading">Nova medição</h2>
              <form onSubmit={(event) => void saveMeasurement(event)}>
                <label>
                  Data da medição
                  <input
                    required
                    type="date"
                    value={measurementDate}
                    onChange={(event) => setMeasurementDate(event.target.value)}
                  />
                </label>
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
                {additionalMeasurements.map((measurement, index) => (
                  <fieldset className="form-group" key={index}>
                    <legend>Medida adicional {index + 1}</legend>
                    <label>
                      Tipo da medida {index + 1}
                      <select
                        aria-label={`Tipo da medida ${index + 1}`}
                        value={measurement.key}
                        onChange={(event) =>
                          setAdditionalMeasurements((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, key: event.target.value } : item,
                            ),
                          )
                        }
                      >
                        {BODY_MEASUREMENT_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {measurement.key === 'custom' && (
                      <label>
                        Nome da medida {index + 1}
                        <input
                          required
                          value={measurement.customLabel}
                          onChange={(event) =>
                            setAdditionalMeasurements((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, customLabel: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    )}
                    <label>
                      Unidade da medida {index + 1}
                      <select
                        aria-label={`Unidade da medida ${index + 1}`}
                        value={measurement.unit}
                        onChange={(event) =>
                          setAdditionalMeasurements((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, unit: event.target.value } : item,
                            ),
                          )
                        }
                      >
                        <option value="cm">cm</option>
                        <option value="mm">mm</option>
                        <option value="in">polegadas</option>
                      </select>
                    </label>
                    <label>
                      Valor da medida {index + 1}
                      <input
                        aria-label={`Valor da medida ${index + 1}`}
                        min="0.1"
                        required
                        step="0.1"
                        type="number"
                        value={measurement.value}
                        onChange={(event) =>
                          setAdditionalMeasurements((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, value: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setAdditionalMeasurements((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      Remover medida {index + 1}
                    </button>
                  </fieldset>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setAdditionalMeasurements((current) => [
                      ...current,
                      { customLabel: '', key: 'abdomen', unit: 'cm', value: '' },
                    ])
                  }
                >
                  Adicionar outra medida
                </button>
                <button type="submit">Salvar medida</button>
              </form>
            </section>
          </details>
        </section>
      )}

      <button className="primary sticky-action" type="button" onClick={onSync}>
        Sincronizar agora
      </button>
    </main>
  );
}

function workoutProgress(execution: ExecutionView): number {
  const sets = execution.exercises.flatMap((exercise) => exercise.sets);
  if (sets.length === 0) return 0;
  return Math.round((sets.filter((set) => set.completed).length / sets.length) * 100);
}
