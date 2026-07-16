import { SYSTEM_EXERCISES, type SyncEntityType } from '@torkout/contracts';
import { useEffect, useState, type FormEvent } from 'react';

import { syncStateMessage, trackingMetricLabel } from '../presentation';
import {
  entityKey,
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

const catalog: ExerciseOption[] = [
  SYSTEM_EXERCISES.pushUp,
  SYSTEM_EXERCISES.squat,
  SYSTEM_EXERCISES.walk,
];

const weekdayOptions = [
  { label: 'Segunda-feira', value: 1 },
  { label: 'Terça-feira', value: 2 },
  { label: 'Quarta-feira', value: 3 },
  { label: 'Quinta-feira', value: 4 },
  { label: 'Sexta-feira', value: 5 },
  { label: 'Sábado', value: 6 },
  { label: 'Domingo', value: 7 },
] as const;

type ActivityType = 'strength' | 'walk' | 'rest' | 'other';

interface ExerciseDraft {
  exerciseId: string;
  setCount: number;
  target: string;
}

function defaultDraft(type: ActivityType): ExerciseDraft {
  return type === 'walk'
    ? { exerciseId: SYSTEM_EXERCISES.walk.id, setCount: 1, target: '5000' }
    : { exerciseId: SYSTEM_EXERCISES.pushUp.id, setCount: 3, target: '12' };
}

function isoWeekday(date: Date): number {
  return date.getUTCDay() || 7;
}

function localExerciseViews(
  exercises: Array<Record<string, unknown> & { sets: Array<Record<string, unknown>> }>,
): Record<string, unknown>[] {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: (exercise.sets as Array<Record<string, unknown>>).map((set) => ({
      actualDistanceMeters: null,
      actualDurationSeconds: null,
      actualRepetitions: null,
      completed: false,
      id: set.id,
      plannedDistanceMeters: set.targetDistanceMeters ?? null,
      plannedDurationSeconds: set.targetDurationSeconds ?? null,
      plannedRepetitions: set.targetRepetitions ?? null,
      setNumber: set.setNumber,
    })),
    status: 'planned',
  }));
}

function recordsOf(records: LocalRecord[], entityType: SyncEntityType): LocalRecord[] {
  return records.filter((record) => record.entityType === entityType && record.deletedAt === null);
}

function stringField(data: Record<string, unknown>, key: string, fallback = ''): string {
  return typeof data[key] === 'string' ? data[key] : fallback;
}

export function PlanningScreen({ database, onBack, onSync, syncState }: PlanningScreenProps) {
  const [activeArea, setActiveArea] = useState<'catalog' | 'weekly' | 'adhoc'>('catalog');
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [message, setMessage] = useState(
    'Alterações são salvas neste dispositivo antes da sincronização.',
  );
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseMetric, setExerciseMetric] =
    useState<ExerciseOption['trackingMetric']>('repetitions');
  const [planName, setPlanName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('strength');
  const [exerciseDrafts, setExerciseDrafts] = useState<ExerciseDraft[]>([defaultDraft('strength')]);
  const [localTime, setLocalTime] = useState('18:00');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [adHocName, setAdHocName] = useState('');
  const [adHocDate, setAdHocDate] = useState(new Date().toISOString().slice(0, 10));
  const [adHocType, setAdHocType] = useState<ActivityType>('strength');
  const [adHocExerciseDrafts, setAdHocExerciseDrafts] = useState<ExerciseDraft[]>([
    defaultDraft('strength'),
  ]);

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
    setMessage('Exercício salvo localmente e pendente de sincronização.');
    await refresh();
  }

  function changeActivityType(type: ActivityType): void {
    setActivityType(type);
    setExerciseDrafts(type === 'rest' ? [] : [defaultDraft(type)]);
  }

  function updateDraft(index: number, patch: Partial<ExerciseDraft>): void {
    setExerciseDrafts((current) =>
      current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)),
    );
  }

  function changeAdHocType(type: ActivityType): void {
    setAdHocType(type);
    setAdHocExerciseDrafts(type === 'rest' ? [] : [defaultDraft(type)]);
  }

  function updateAdHocDraft(index: number, patch: Partial<ExerciseDraft>): void {
    setAdHocExerciseDrafts((current) =>
      current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)),
    );
  }

  function plannedExercises(drafts: ExerciseDraft[]) {
    return drafts.map((draft, sortOrder) => {
      const exercise = exercises.find((item) => item.id === draft.exerciseId)!;
      const numericTarget = Number(draft.target);
      const targetField =
        exercise.trackingMetric === 'distance'
          ? { targetDistanceMeters: numericTarget }
          : exercise.trackingMetric === 'duration'
            ? { targetDurationSeconds: numericTarget }
            : { targetRepetitions: numericTarget };
      return {
        exerciseId: exercise.id,
        id: crypto.randomUUID(),
        name: exercise.name,
        notes: null,
        sets: Array.from({ length: draft.setCount }, (_, index) => ({
          id: crypto.randomUUID(),
          setNumber: index + 1,
          ...targetField,
        })),
        sortOrder,
        trackingMetric: exercise.trackingMetric,
      };
    });
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
    if ((activityType !== 'rest' && exerciseDrafts.length === 0) || weekdays.length === 0) {
      setMessage('Escolha os exercícios e ao menos um dia da semana.');
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
        payload: {
          name: planName.trim(),
          status: 'active',
          validFrom,
          validUntil: validUntil || null,
        },
      },
      occurredAt,
    );
    const templateExercises = plannedExercises(exerciseDrafts);
    const rules = weekdays.map((weekday) => ({
      id: crypto.randomUUID(),
      localTime,
      timeZone: 'America/Cuiaba',
      validFrom,
      validUntil: validUntil || null,
      weekday,
    }));
    await queueLocalMutation(
      database,
      {
        entityId: templateId,
        entityType: 'workout_template',
        operation: 'create',
        payload: {
          exercises: templateExercises,
          name: templateName.trim(),
          notes: null,
          planId,
          rules,
          type: activityType,
        },
      },
      new Date(occurredAt.getTime() + 1),
    );
    const lastDate = new Date(`${validUntil || validFrom}T12:00:00Z`);
    if (!validUntil) lastDate.setUTCDate(lastDate.getUTCDate() + 27);
    const cursor = new Date(`${validFrom}T12:00:00Z`);
    let offset = 2;
    while (cursor <= lastDate) {
      const weekday = isoWeekday(cursor);
      const rule = rules.find((candidate) => candidate.weekday === weekday);
      if (rule) {
        const sessionId = crypto.randomUUID();
        const sessionExercises = plannedExercises(exerciseDrafts);
        const sessionPayload = {
          exercises: sessionExercises,
          notes: null,
          plannedLocalDate: cursor.toISOString().slice(0, 10),
          scheduleRuleId: rule.id,
          source: 'scheduled',
          status: 'planned',
          suggestedLocalTime: localTime,
          templateId,
          templateNameSnapshot: templateName.trim(),
          timeZone: 'America/Cuiaba',
          type: activityType,
        };
        await queueLocalMutation(
          database,
          {
            entityId: sessionId,
            entityType: 'workout_session',
            operation: 'create',
            payload: sessionPayload,
          },
          new Date(occurredAt.getTime() + offset++),
        );
        const sessionRecord = await database.records.get(entityKey('workout_session', sessionId));
        if (sessionRecord) {
          await database.records.put({
            ...sessionRecord,
            data: {
              ...sessionPayload,
              exercises: localExerciseViews(
                sessionExercises as Array<
                  Record<string, unknown> & { sets: Array<Record<string, unknown>> }
                >,
              ),
              jointPainStatus: 'unknown',
              version: 0,
            },
          });
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    setPlanName('');
    setTemplateName('');
    setMessage('Planejamento salvo localmente e pendente de sincronização.');
    await refresh();
  }

  async function addAdHocSession(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const sessionId = crypto.randomUUID();
    if (adHocType !== 'rest' && adHocExerciseDrafts.length === 0) {
      setMessage('Adicione ao menos um exercício à sessão.');
      return;
    }
    const sessionExercises = plannedExercises(adHocExerciseDrafts);
    const payload = {
      exercises: sessionExercises,
      notes: null,
      plannedLocalDate: adHocDate,
      scheduleRuleId: null,
      source: 'ad_hoc',
      status: 'planned',
      suggestedLocalTime: localTime,
      templateId: null,
      templateNameSnapshot: adHocName.trim(),
      timeZone: 'America/Cuiaba',
      type: adHocType,
    };
    await queueLocalMutation(database, {
      entityId: sessionId,
      entityType: 'workout_session',
      operation: 'create',
      payload,
    });
    const sessionRecord = await database.records.get(entityKey('workout_session', sessionId));
    if (sessionRecord) {
      await database.records.put({
        ...sessionRecord,
        data: {
          ...payload,
          exercises: localExerciseViews(
            sessionExercises as Array<
              Record<string, unknown> & { sets: Array<Record<string, unknown>> }
            >,
          ),
          jointPainStatus: 'unknown',
          version: 0,
        },
      });
    }
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
        {message || syncStateMessage(syncState)}
      </p>

      <nav aria-label="Áreas do planejamento" className="planning-tabs">
        <button
          aria-pressed={activeArea === 'catalog'}
          type="button"
          onClick={() => setActiveArea('catalog')}
        >
          Exercícios
        </button>
        <button
          aria-pressed={activeArea === 'weekly'}
          type="button"
          onClick={() => setActiveArea('weekly')}
        >
          Plano semanal
        </button>
        <button
          aria-pressed={activeArea === 'adhoc'}
          type="button"
          onClick={() => setActiveArea('adhoc')}
        >
          Sessão avulsa
        </button>
      </nav>

      {activeArea === 'catalog' && (
        <section className="card planning-section" aria-labelledby="exercise-heading">
          <p className="eyebrow">Catálogo</p>
          <h2 id="exercise-heading">Exercícios</h2>
          <ul aria-label="Catálogo de exercícios" className="compact-list exercise-catalog-list">
            {exercises.map((exercise) => (
              <li key={exercise.id}>
                {exercise.name} · {trackingMetricLabel(exercise.trackingMetric)}
              </li>
            ))}
          </ul>
          <form
            aria-label="Novo exercício personalizado"
            onSubmit={(event) => void addExercise(event)}
          >
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
      )}

      {activeArea === 'weekly' && (
        <section className="card planning-section" aria-labelledby="weekly-heading">
          <p className="eyebrow">Recorrência</p>
          <h2 id="weekly-heading">Plano semanal</h2>
          <p className="field-hint">
            Alterações em planos recorrentes afetam somente sessões futuras; o histórico permanece
            intacto.
          </p>
          {plans.length > 0 && (
            <ul className="compact-list">
              {plans.map((plan) => (
                <li key={plan.entityId}>{stringField(plan.data, 'name', 'Plano')}</li>
              ))}
            </ul>
          )}
          <form className="weekly-plan-form" onSubmit={(event) => void savePlanning(event)}>
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
              Tipo de atividade
              <select
                value={activityType}
                onChange={(event) => changeActivityType(event.target.value as ActivityType)}
              >
                <option value="strength">Força</option>
                <option value="walk">Caminhada</option>
                <option value="rest">Descanso/recuperação</option>
                <option value="other">Outra atividade</option>
              </select>
            </label>
            {exerciseDrafts.map((draft, index) => (
              <fieldset className="form-group" key={`${index}-${draft.exerciseId}`}>
                <legend>Exercício {index + 1}</legend>
                <label>
                  Exercício {index + 1}
                  <select
                    aria-label={`Exercício ${index + 1}`}
                    value={draft.exerciseId}
                    onChange={(event) => updateDraft(index, { exerciseId: event.target.value })}
                  >
                    {exercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Séries do exercício {index + 1}
                  <input
                    aria-label={`Séries do exercício ${index + 1}`}
                    min="1"
                    type="number"
                    value={draft.setCount}
                    onChange={(event) =>
                      updateDraft(index, { setCount: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Alvo por série do exercício {index + 1}
                  <input
                    aria-label={`Alvo por série do exercício ${index + 1}`}
                    min="1"
                    type="number"
                    value={draft.target}
                    onChange={(event) => updateDraft(index, { target: event.target.value })}
                  />
                </label>
                {exerciseDrafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExerciseDrafts((current) => current.filter((_, item) => item !== index))
                    }
                  >
                    Remover exercício {index + 1}
                  </button>
                )}
              </fieldset>
            ))}
            {activityType !== 'rest' && (
              <button
                type="button"
                onClick={() =>
                  setExerciseDrafts((current) => [...current, defaultDraft('strength')])
                }
              >
                Adicionar exercício ao treino
              </button>
            )}
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
            <label>
              Vigência até
              <input
                min={validFrom}
                type="date"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </label>
            <fieldset className="weekday-picker">
              <legend>Dias da semana</legend>
              <div className="weekday-options">
                {weekdayOptions.map((weekday) => (
                  <label className="inline-check" key={weekday.value}>
                    <input
                      checked={weekdays.includes(weekday.value)}
                      type="checkbox"
                      onChange={() => toggleWeekday(weekday.value)}
                    />
                    {weekday.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="primary" type="submit">
              Salvar planejamento
            </button>
          </form>
        </section>
      )}

      {activeArea === 'adhoc' && (
        <section className="card planning-section" aria-labelledby="adhoc-heading">
          <p className="eyebrow">Agenda</p>
          <h2 id="adhoc-heading">Sessões avulsas</h2>
          <form onSubmit={(event) => void addAdHocSession(event)}>
            <label>
              Tipo da sessão avulsa
              <select
                value={adHocType}
                onChange={(event) => changeAdHocType(event.target.value as ActivityType)}
              >
                <option value="strength">Força</option>
                <option value="walk">Caminhada</option>
                <option value="rest">Descanso/recuperação</option>
                <option value="other">Outra atividade</option>
              </select>
            </label>
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
            {adHocExerciseDrafts.map((draft, index) => (
              <fieldset className="exercise-draft" key={`${index}-${draft.exerciseId}`}>
                <legend>Exercício {index + 1} da sessão</legend>
                <label>
                  Exercício da sessão {index + 1}
                  <select
                    aria-label={`Exercício da sessão ${index + 1}`}
                    value={draft.exerciseId}
                    onChange={(event) =>
                      updateAdHocDraft(index, { exerciseId: event.target.value })
                    }
                  >
                    {exercises.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Séries da sessão {index + 1}
                  <input
                    aria-label={`Séries da sessão ${index + 1}`}
                    min="1"
                    type="number"
                    value={draft.setCount}
                    onChange={(event) =>
                      updateAdHocDraft(index, { setCount: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  Alvo da sessão {index + 1}
                  <input
                    aria-label={`Alvo da sessão ${index + 1}`}
                    min="1"
                    type="number"
                    value={draft.target}
                    onChange={(event) => updateAdHocDraft(index, { target: event.target.value })}
                  />
                </label>
                {adHocExerciseDrafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setAdHocExerciseDrafts((current) =>
                        current.filter((_, item) => item !== index),
                      )
                    }
                  >
                    Remover exercício da sessão {index + 1}
                  </button>
                )}
              </fieldset>
            ))}
            {adHocType !== 'rest' && (
              <button
                type="button"
                onClick={() =>
                  setAdHocExerciseDrafts((current) => [...current, defaultDraft('strength')])
                }
              >
                Adicionar exercício à sessão
              </button>
            )}
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
                className="danger"
                type="button"
                onClick={() => void updateSession(session, { status: 'cancelled' })}
              >
                Cancelar sessão
              </button>
              <div
                className="button-row"
                aria-label={`Ordenar ${stringField(session.data, 'templateNameSnapshot', 'sessão')}`}
              >
                <button type="button" onClick={() => void moveSession(session, -1)}>
                  Mover para o dia anterior
                </button>
                <button type="button" onClick={() => void moveSession(session, 1)}>
                  Mover para o dia seguinte
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <button className="primary sticky-action" type="button" onClick={onSync}>
        Sincronizar agora
      </button>
    </main>
  );

  async function moveSession(record: LocalRecord, days: number): Promise<void> {
    const current = new Date(`${stringField(record.data, 'plannedLocalDate')}T12:00:00Z`);
    current.setUTCDate(current.getUTCDate() + days);
    await updateSession(record, { plannedLocalDate: current.toISOString().slice(0, 10) });
  }
}
