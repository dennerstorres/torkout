import { SYSTEM_EXERCISES, type SyncEntityType } from '@torkout/contracts';
import { useEffect, useState, type FormEvent } from 'react';

import {
  queueLocalMutation,
  type LocalRecord,
  type UserSyncDatabase,
} from '../sync/local-database';
import type { SyncState } from '../sync/sync-coordinator';

interface PlanningScreenProps {
  database: UserSyncDatabase;
  onBack(): void;
  onSync(): void;
  syncState: SyncState;
}

interface ExerciseOption {
  id: string;
  name: string;
  trackingMetric: 'distance' | 'duration' | 'repetitions';
}

const catalog: ExerciseOption[] = [SYSTEM_EXERCISES.pushUp, SYSTEM_EXERCISES.squat];

function recordsOf(records: LocalRecord[], entityType: SyncEntityType): LocalRecord[] {
  return records.filter((record) => record.entityType === entityType && record.deletedAt === null);
}

function stringField(data: Record<string, unknown>, key: string, fallback = ''): string {
  return typeof data[key] === 'string' ? data[key] : fallback;
}

export function PlanningScreen({ database, onBack, onSync, syncState }: PlanningScreenProps) {
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [message, setMessage] = useState(
    'Alterações são salvas neste dispositivo antes da sincronização.',
  );
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseMetric, setExerciseMetric] =
    useState<ExerciseOption['trackingMetric']>('repetitions');
  const [planName, setPlanName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(SYSTEM_EXERCISES.pushUp.id);
  const [target, setTarget] = useState('12');
  const [localTime, setLocalTime] = useState('18:00');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [adHocName, setAdHocName] = useState('');
  const [adHocDate, setAdHocDate] = useState(new Date().toISOString().slice(0, 10));

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

  const customExercises = recordsOf(records, 'exercise').map((record) => ({
    id: record.entityId,
    name: stringField(record.data, 'name', 'Exercício'),
    trackingMetric: stringField(
      record.data,
      'trackingMetric',
      'repetitions',
    ) as ExerciseOption['trackingMetric'],
  }));
  const exercises = [...catalog, ...customExercises];
  const plans = recordsOf(records, 'training_plan');
  const sessions = recordsOf(records, 'workout_session');

  async function addExercise(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const id = crypto.randomUUID();
    await queueLocalMutation(database, {
      entityId: id,
      entityType: 'exercise',
      operation: 'create',
      payload: {
        active: true,
        category: 'Personalizado',
        instructions: null,
        name: exerciseName.trim(),
        trackingMetric: exerciseMetric,
      },
    });
    setExerciseName('');
    setSelectedExerciseId(id);
    setMessage('Exercício salvo localmente e pendente de sincronização.');
    await refresh();
  }

  function toggleWeekday(weekday: number): void {
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((candidate) => candidate !== weekday)
        : [...current, weekday],
    );
  }

  async function savePlanning(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const exercise = exercises.find((item) => item.id === selectedExerciseId);
    if (!exercise || weekdays.length === 0) {
      setMessage('Escolha um exercício e ao menos um dia da semana.');
      return;
    }
    const planId = crypto.randomUUID();
    const templateId = crypto.randomUUID();
    const occurredAt = new Date();
    await queueLocalMutation(
      database,
      {
        entityId: planId,
        entityType: 'training_plan',
        operation: 'create',
        payload: { name: planName.trim(), status: 'active', validFrom, validUntil: null },
      },
      occurredAt,
    );
    const numericTarget = Number(target);
    const setTarget =
      exercise.trackingMetric === 'distance'
        ? { targetDistanceMeters: numericTarget }
        : exercise.trackingMetric === 'duration'
          ? { targetDurationSeconds: numericTarget }
          : { targetRepetitions: numericTarget };
    await queueLocalMutation(
      database,
      {
        entityId: templateId,
        entityType: 'workout_template',
        operation: 'create',
        payload: {
          exercises: [
            {
              exerciseId: exercise.id,
              id: crypto.randomUUID(),
              name: exercise.name,
              notes: null,
              sets: [1, 2, 3].map((setNumber) => ({
                id: crypto.randomUUID(),
                setNumber,
                ...setTarget,
              })),
              sortOrder: 0,
              trackingMetric: exercise.trackingMetric,
            },
          ],
          name: templateName.trim(),
          notes: null,
          planId,
          rules: weekdays.map((weekday) => ({
            id: crypto.randomUUID(),
            localTime,
            timeZone: 'America/Cuiaba',
            validFrom,
            validUntil: null,
            weekday,
          })),
          type: exercise.trackingMetric === 'distance' ? 'walk' : 'strength',
        },
      },
      new Date(occurredAt.getTime() + 1),
    );
    setPlanName('');
    setTemplateName('');
    setMessage('Planejamento salvo localmente e pendente de sincronização.');
    await refresh();
  }

  async function addAdHocSession(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await queueLocalMutation(database, {
      entityId: crypto.randomUUID(),
      entityType: 'workout_session',
      operation: 'create',
      payload: {
        exercises: [],
        notes: null,
        plannedLocalDate: adHocDate,
        scheduleRuleId: null,
        source: 'ad_hoc',
        status: 'planned',
        suggestedLocalTime: localTime,
        templateId: null,
        templateNameSnapshot: adHocName.trim(),
        timeZone: 'America/Cuiaba',
        type: 'other',
      },
    });
    setAdHocName('');
    setMessage('Sessão avulsa salva localmente.');
    await refresh();
  }

  async function updateSession(
    record: LocalRecord,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await queueLocalMutation(database, {
      entityId: record.entityId,
      entityType: 'workout_session',
      operation: 'update',
      payload,
    });
    setMessage('Sessão atualizada localmente.');
    await refresh();
  }

  return (
    <main className="planning-layout">
      <header className="planning-header">
        <div>
          <p className="eyebrow">Organize a semana</p>
          <h1>Planejamento</h1>
        </div>
        <button type="button" onClick={onBack}>
          Voltar
        </button>
      </header>

      <p className="sync-note" role="status">
        {message} Estado: {syncState}.
      </p>

      <section className="card planning-section" aria-labelledby="exercise-heading">
        <h2 id="exercise-heading">Exercícios</h2>
        <ul className="compact-list">
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              {exercise.name} · {exercise.trackingMetric}
            </li>
          ))}
        </ul>
        <form onSubmit={(event) => void addExercise(event)}>
          <label>
            Nome do exercício
            <input
              required
              value={exerciseName}
              onChange={(event) => setExerciseName(event.target.value)}
            />
          </label>
          <label>
            Métrica
            <select
              value={exerciseMetric}
              onChange={(event) =>
                setExerciseMetric(event.target.value as ExerciseOption['trackingMetric'])
              }
            >
              <option value="repetitions">Repetições</option>
              <option value="duration">Duração</option>
              <option value="distance">Distância</option>
            </select>
          </label>
          <button className="primary" type="submit">
            Adicionar exercício
          </button>
        </form>
      </section>

      <section className="card planning-section" aria-labelledby="weekly-heading">
        <h2 id="weekly-heading">Plano semanal</h2>
        {plans.length > 0 && (
          <ul className="compact-list">
            {plans.map((plan) => (
              <li key={plan.entityId}>{stringField(plan.data, 'name', 'Plano')}</li>
            ))}
          </ul>
        )}
        <form onSubmit={(event) => void savePlanning(event)}>
          <label>
            Nome do plano
            <input
              required
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
            />
          </label>
          <label>
            Nome do treino
            <input
              required
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </label>
          <label>
            Exercício do treino
            <select
              value={selectedExerciseId}
              onChange={(event) => setSelectedExerciseId(event.target.value)}
            >
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Repetições por série
            <input
              min="1"
              required
              type="number"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
          <label>
            Horário local
            <input
              required
              type="time"
              value={localTime}
              onChange={(event) => setLocalTime(event.target.value)}
            />
          </label>
          <label>
            Vigência a partir de
            <input
              required
              type="date"
              value={validFrom}
              onChange={(event) => setValidFrom(event.target.value)}
            />
          </label>
          <fieldset>
            <legend>Dias da semana</legend>
            <label className="inline-check">
              <input
                checked={weekdays.includes(1)}
                type="checkbox"
                onChange={() => toggleWeekday(1)}
              />
              Segunda-feira
            </label>
            <label className="inline-check">
              <input
                checked={weekdays.includes(5)}
                type="checkbox"
                onChange={() => toggleWeekday(5)}
              />
              Sexta-feira
            </label>
          </fieldset>
          <button className="primary" type="submit">
            Salvar planejamento
          </button>
        </form>
      </section>

      <section className="card planning-section" aria-labelledby="adhoc-heading">
        <h2 id="adhoc-heading">Sessão avulsa</h2>
        <form onSubmit={(event) => void addAdHocSession(event)}>
          <label>
            Nome da sessão avulsa
            <input
              required
              value={adHocName}
              onChange={(event) => setAdHocName(event.target.value)}
            />
          </label>
          <label>
            Data da sessão avulsa
            <input
              required
              type="date"
              value={adHocDate}
              onChange={(event) => setAdHocDate(event.target.value)}
            />
          </label>
          <button className="primary" type="submit">
            Criar sessão avulsa
          </button>
        </form>
        {sessions.map((session) => (
          <article className="session-card" key={session.entityId}>
            <h3>{stringField(session.data, 'templateNameSnapshot', 'Sessão')}</h3>
            <label>
              Reagendar {stringField(session.data, 'templateNameSnapshot', 'sessão')}
              <input
                type="date"
                value={stringField(session.data, 'plannedLocalDate')}
                onChange={(event) =>
                  void updateSession(session, { plannedLocalDate: event.target.value })
                }
              />
            </label>
            <button
              type="button"
              onClick={() => void updateSession(session, { status: 'cancelled' })}
            >
              Cancelar sessão
            </button>
          </article>
        ))}
      </section>

      <button className="primary sticky-action" type="button" onClick={onSync}>
        Sincronizar agora
      </button>
    </main>
  );
}
