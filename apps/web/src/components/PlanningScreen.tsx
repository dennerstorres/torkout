import type { SyncEntityType } from '@torkout/contracts';
import { useMemo, useState, type FormEvent } from 'react';

import { syncStateMessage, trackingMetricLabel } from '../presentation';
import {
  entityKey,
  queueLocalMutation,
  type LocalRecord,
  type UserSyncDatabase,
} from '../sync/local-database';
import type { SyncState } from '../sync/sync-coordinator';
import { useLocalRecords } from '../sync/use-local-records';
import { HabitManagement } from './HabitManagement';

interface PlanningScreenProps {
  database: UserSyncDatabase;
  onBack(): void;
  syncState: SyncState;
}

interface ExerciseOption {
  id: string;
  name: string;
  trackingMetric: 'distance' | 'duration' | 'repetitions';
}

const weekdayOptions = [
  { label: 'Segunda-feira', value: 1 },
  { label: 'Terça-feira', value: 2 },
  { label: 'Quarta-feira', value: 3 },
  { label: 'Quinta-feira', value: 4 },
  { label: 'Sexta-feira', value: 5 },
  { label: 'Sábado', value: 6 },
  { label: 'Domingo', value: 7 },
] as const;

const activityTypeLabels: Record<ActivityType, string> = {
  other: 'Outra atividade',
  rest: 'Descanso/recuperação',
  strength: 'Força',
  walk: 'Caminhada',
};

const sessionStatusLabels: Record<string, string> = {
  cancelled: 'Cancelada',
  completed: 'Concluída',
  in_progress: 'Em andamento',
  missed: 'Não realizada',
  partial: 'Parcial',
  planned: 'Planejada',
};

type ActivityType = 'strength' | 'walk' | 'rest' | 'other';

interface ExerciseDraft {
  exerciseId: string;
  setCount: number;
  target: string;
}

function draftsFromExercises(value: unknown): ExerciseDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const exercise = item as Record<string, unknown>;
    const sets = Array.isArray(exercise.sets)
      ? (exercise.sets as Array<Record<string, unknown>>)
      : [];
    const first = sets[0] ?? {};
    return {
      exerciseId: String(exercise.exerciseId ?? ''),
      setCount: Math.max(sets.length, 1),
      target: String(
        first.targetDistanceMeters ??
          first.plannedDistanceMeters ??
          first.targetDurationSeconds ??
          first.plannedDurationSeconds ??
          first.targetRepetitions ??
          first.plannedRepetitions ??
          1,
      ),
    };
  });
}

function defaultDraft(type: ActivityType, exercises: ExerciseOption[]): ExerciseDraft {
  const preferred =
    type === 'walk'
      ? exercises.find((exercise) => exercise.trackingMetric === 'distance')
      : exercises.find((exercise) => exercise.trackingMetric === 'repetitions');
  return type === 'walk'
    ? { exerciseId: preferred?.id ?? exercises[0]?.id ?? '', setCount: 1, target: '5000' }
    : { exerciseId: preferred?.id ?? exercises[0]?.id ?? '', setCount: 3, target: '12' };
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

function AdHocSessionList({
  onDelete,
  onEdit,
  sessions,
}: {
  onDelete(session: LocalRecord): void;
  onEdit(session: LocalRecord): void;
  sessions: LocalRecord[];
}) {
  if (sessions.length === 0) {
    return <p className="planning-empty-state">Nenhuma sessão avulsa cadastrada.</p>;
  }
  return (
    <ul className="planning-management-list">
      {sessions.map((session) => {
        const name = stringField(session.data, 'templateNameSnapshot', 'Sessão');
        const type = stringField(session.data, 'type', 'other') as ActivityType;
        const status = stringField(session.data, 'status', 'planned');
        return (
          <li key={session.entityId}>
            <div>
              <strong>{name}</strong>
              <span>{activityTypeLabels[type]}</span>
              <span>{stringField(session.data, 'plannedLocalDate')}</span>
              <span>{sessionStatusLabels[status] ?? status}</span>
            </div>
            {status === 'planned' ? (
              <div className="button-row">
                <button type="button" onClick={() => onEdit(session)}>
                  Editar {name}
                </button>
                <button className="danger" type="button" onClick={() => onDelete(session)}>
                  Excluir {name}
                </button>
              </div>
            ) : (
              <span>Sessão histórica: edição e exclusão indisponíveis.</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PlanningScreen({ database, onBack, syncState }: PlanningScreenProps) {
  const [activeArea, setActiveArea] = useState<'catalog' | 'weekly' | 'adhoc' | 'habits'>(
    'catalog',
  );
  const [records, setRecords] = useLocalRecords(database);
  const [message, setMessage] = useState(
    'Alterações são salvas neste dispositivo antes da sincronização.',
  );
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseMetric, setExerciseMetric] =
    useState<ExerciseOption['trackingMetric']>('repetitions');
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('strength');
  const [exerciseDrafts, setExerciseDrafts] = useState<ExerciseDraft[]>([
    defaultDraft('strength', []),
  ]);
  const [localTime, setLocalTime] = useState('18:00');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [editingPlan, setEditingPlan] = useState<{ planId: string; templateId: string } | null>(
    null,
  );
  const [adHocName, setAdHocName] = useState('');
  const [adHocDate, setAdHocDate] = useState(new Date().toISOString().slice(0, 10));
  const [adHocType, setAdHocType] = useState<ActivityType>('strength');
  const [adHocExerciseDrafts, setAdHocExerciseDrafts] = useState<ExerciseDraft[]>([
    defaultDraft('strength', []),
  ]);
  const [editingAdHocId, setEditingAdHocId] = useState<string | null>(null);

  // Uma exclusão interrompida no meio das mutações precisa ser informada; sem isso a promessa
  // rejeitada some e a tela sugere que tudo foi salvo.
  function reportWriteFailure(): void {
    setMessage('Não foi possível concluir a alteração neste dispositivo.');
  }

  // A leitura direta depois de cada mutação garante que o `await` do formulário só termine com a
  // gravação concluída; a observação da réplica cuida das mudanças vindas de fora desta tela.
  async function refresh(): Promise<void> {
    setRecords(await database.records.toArray());
  }

  const exerciseRecords = useMemo(() => recordsOf(records, 'exercise'), [records]);
  const exercises = useMemo(
    () =>
      exerciseRecords.map((record) => ({
        active: record.data.active !== false,
        id: record.entityId,
        name: stringField(record.data, 'name', 'Exercício'),
        trackingMetric: stringField(
          record.data,
          'trackingMetric',
          'repetitions',
        ) as ExerciseOption['trackingMetric'],
      })),
    [exerciseRecords],
  );
  const plans = recordsOf(records, 'training_plan');
  const templates = recordsOf(records, 'workout_template');
  const sessions = recordsOf(records, 'workout_session');
  const adHocSessions = sessions.filter((record) => record.data.source === 'ad_hoc');
  const habits = recordsOf(records, 'habit_definition');
  const habitEntries = recordsOf(records, 'habit_entry');

  async function saveExercise(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const id = editingExerciseId ?? crypto.randomUUID();
    await queueLocalMutation(database, {
      entityId: id,
      entityType: 'exercise',
      operation: editingExerciseId ? 'update' : 'create',
      payload: {
        active: true,
        category: 'Personalizado',
        instructions: null,
        name: exerciseName.trim(),
        trackingMetric: exerciseMetric,
      },
    });
    setEditingExerciseId(null);
    setExerciseName('');
    setMessage('Exercício salvo localmente e pendente de sincronização.');
    await refresh();
  }

  function editExercise(record: LocalRecord): void {
    setEditingExerciseId(record.entityId);
    setExerciseName(stringField(record.data, 'name'));
    setExerciseMetric(
      stringField(record.data, 'trackingMetric', 'repetitions') as ExerciseOption['trackingMetric'],
    );
  }

  async function toggleExercise(record: LocalRecord): Promise<void> {
    await queueLocalMutation(database, {
      entityId: record.entityId,
      entityType: 'exercise',
      operation: 'update',
      payload: { active: record.data.active === false },
    });
    setMessage(
      record.data.active === false
        ? 'Exercício ativado localmente.'
        : 'Exercício desativado localmente.',
    );
    await refresh();
  }

  async function deleteExercise(record: LocalRecord): Promise<void> {
    const name = stringField(record.data, 'name', 'exercício');
    if (!window.confirm(`Excluir ${name}? O histórico já registrado será preservado.`)) return;
    await queueLocalMutation(database, {
      entityId: record.entityId,
      entityType: 'exercise',
      operation: 'delete',
      payload: {},
    });
    if (editingExerciseId === record.entityId) setEditingExerciseId(null);
    setMessage('Exercício excluído localmente.');
    await refresh();
  }

  function changeActivityType(type: ActivityType): void {
    setActivityType(type);
    setExerciseDrafts(type === 'rest' ? [] : [defaultDraft(type, exercises)]);
  }

  function updateDraft(index: number, patch: Partial<ExerciseDraft>): void {
    setExerciseDrafts((current) =>
      current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)),
    );
  }

  function changeAdHocType(type: ActivityType): void {
    setAdHocType(type);
    setAdHocExerciseDrafts(type === 'rest' ? [] : [defaultDraft(type, exercises)]);
  }

  function updateAdHocDraft(index: number, patch: Partial<ExerciseDraft>): void {
    setAdHocExerciseDrafts((current) =>
      current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)),
    );
  }

  function plannedExercises(drafts: ExerciseDraft[], type: ActivityType) {
    return drafts.map((draft, sortOrder) => {
      const selectedId = draft.exerciseId || defaultDraft(type, exercises).exerciseId;
      const exercise = exercises.find((item) => item.id === selectedId)!;
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
    if (
      (activityType !== 'rest' && (exerciseDrafts.length === 0 || exercises.length === 0)) ||
      weekdays.length === 0
    ) {
      setMessage('Escolha os exercícios e ao menos um dia da semana.');
      return;
    }
    const planId = editingPlan?.planId ?? crypto.randomUUID();
    const templateId = editingPlan?.templateId ?? crypto.randomUUID();
    const occurredAt = new Date();
    let mutationOffset = 0;
    if (editingPlan) {
      const obsoleteSessions = sessions.filter(
        (session) =>
          session.data.templateId === templateId &&
          session.data.status === 'planned' &&
          stringField(session.data, 'plannedLocalDate') >= validFrom,
      );
      for (const session of obsoleteSessions) {
        await queueLocalMutation(
          database,
          {
            entityId: session.entityId,
            entityType: 'workout_session',
            operation: 'delete',
            payload: {},
          },
          new Date(occurredAt.getTime() + mutationOffset++),
        );
      }
    }
    await queueLocalMutation(
      database,
      {
        entityId: planId,
        entityType: 'training_plan',
        operation: editingPlan ? 'update' : 'create',
        payload: {
          name: planName.trim(),
          status: 'active',
          validFrom,
          validUntil: validUntil || null,
        },
      },
      new Date(occurredAt.getTime() + mutationOffset++),
    );
    const templateExercises = plannedExercises(exerciseDrafts, activityType);
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
        operation: editingPlan ? 'update' : 'create',
        payload: {
          exercises: templateExercises,
          name: templateName.trim(),
          notes: null,
          planId,
          rules,
          type: activityType,
          ...(editingPlan ? { effectiveFrom: validFrom } : {}),
        },
      },
      new Date(occurredAt.getTime() + mutationOffset++),
    );
    const lastDate = new Date(`${validUntil || validFrom}T12:00:00Z`);
    if (!validUntil) lastDate.setUTCDate(lastDate.getUTCDate() + 27);
    const cursor = new Date(`${validFrom}T12:00:00Z`);
    while (cursor <= lastDate) {
      const weekday = isoWeekday(cursor);
      const rule = rules.find((candidate) => candidate.weekday === weekday);
      if (rule) {
        const sessionId = crypto.randomUUID();
        const sessionExercises = plannedExercises(exerciseDrafts, activityType);
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
          new Date(occurredAt.getTime() + mutationOffset++),
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
    setEditingPlan(null);
    setMessage(
      editingPlan
        ? 'Planejamento atualizado localmente.'
        : 'Planejamento salvo localmente e pendente de sincronização.',
    );
    await refresh();
  }

  function editWeeklyPlan(plan: LocalRecord, template: LocalRecord): void {
    const type = stringField(template.data, 'type', 'strength') as ActivityType;
    const rules = Array.isArray(template.data.rules)
      ? (template.data.rules as Array<Record<string, unknown>>)
      : [];
    setEditingPlan({ planId: plan.entityId, templateId: template.entityId });
    setPlanName(stringField(plan.data, 'name'));
    setTemplateName(stringField(template.data, 'name'));
    setActivityType(type);
    setExerciseDrafts(type === 'rest' ? [] : draftsFromExercises(template.data.exercises));
    setValidFrom(stringField(plan.data, 'validFrom', new Date().toISOString().slice(0, 10)));
    setValidUntil(stringField(plan.data, 'validUntil'));
    setWeekdays(rules.map((rule) => Number(rule.weekday)));
    setLocalTime(stringField(rules[0] ?? {}, 'localTime', '18:00'));
  }

  async function deleteWeeklyPlan(plan: LocalRecord): Promise<void> {
    const name = stringField(plan.data, 'name', 'plano');
    if (!window.confirm(`Excluir ${name}? Sessões já realizadas serão preservadas.`)) return;
    const ownedTemplates = templates.filter((template) => template.data.planId === plan.entityId);
    const templateIds = new Set(ownedTemplates.map((template) => template.entityId));
    const today = new Date().toISOString().slice(0, 10);
    const occurredAt = new Date();
    let offset = 0;
    for (const session of sessions.filter(
      (item) =>
        templateIds.has(String(item.data.templateId)) &&
        item.data.status === 'planned' &&
        stringField(item.data, 'plannedLocalDate') >= today,
    )) {
      await queueLocalMutation(
        database,
        {
          entityId: session.entityId,
          entityType: 'workout_session',
          operation: 'delete',
          payload: {},
        },
        new Date(occurredAt.getTime() + offset++),
      );
    }
    for (const template of ownedTemplates) {
      await queueLocalMutation(
        database,
        {
          entityId: template.entityId,
          entityType: 'workout_template',
          operation: 'delete',
          payload: {},
        },
        new Date(occurredAt.getTime() + offset++),
      );
    }
    await queueLocalMutation(
      database,
      { entityId: plan.entityId, entityType: 'training_plan', operation: 'delete', payload: {} },
      new Date(occurredAt.getTime() + offset),
    );
    if (editingPlan?.planId === plan.entityId) setEditingPlan(null);
    setMessage('Plano semanal excluído localmente; o histórico foi preservado.');
    await refresh();
  }

  async function saveAdHocSession(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const sessionId = editingAdHocId ?? crypto.randomUUID();
    if (adHocType !== 'rest' && (adHocExerciseDrafts.length === 0 || exercises.length === 0)) {
      setMessage('Adicione ao menos um exercício à sessão.');
      return;
    }
    const sessionExercises = plannedExercises(adHocExerciseDrafts, adHocType);
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
      operation: editingAdHocId ? 'update' : 'create',
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
    setEditingAdHocId(null);
    setAdHocName('');
    setMessage(
      editingAdHocId ? 'Sessão avulsa atualizada localmente.' : 'Sessão avulsa salva localmente.',
    );
    await refresh();
  }

  function editAdHocSession(record: LocalRecord): void {
    const type = stringField(record.data, 'type', 'strength') as ActivityType;
    setEditingAdHocId(record.entityId);
    setAdHocName(stringField(record.data, 'templateNameSnapshot'));
    setAdHocDate(stringField(record.data, 'plannedLocalDate'));
    setAdHocType(type);
    setAdHocExerciseDrafts(type === 'rest' ? [] : draftsFromExercises(record.data.exercises));
  }

  async function deleteAdHocSession(record: LocalRecord): Promise<void> {
    const name = stringField(record.data, 'templateNameSnapshot', 'sessão');
    if (!window.confirm(`Excluir ${name}?`)) return;
    await queueLocalMutation(database, {
      entityId: record.entityId,
      entityType: 'workout_session',
      operation: 'delete',
      payload: {},
    });
    if (editingAdHocId === record.entityId) setEditingAdHocId(null);
    setMessage('Sessão avulsa excluída localmente.');
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
        <button
          aria-pressed={activeArea === 'habits'}
          type="button"
          onClick={() => setActiveArea('habits')}
        >
          Hábitos
        </button>
      </nav>

      {activeArea === 'catalog' && (
        <section className="card planning-section" aria-labelledby="exercise-heading">
          <p className="eyebrow">Catálogo</p>
          <h2 id="exercise-heading">Exercícios</h2>
          <ul
            aria-label="Catálogo de exercícios"
            className="planning-management-list exercise-catalog-list"
          >
            {exerciseRecords.map((record) => {
              const name = stringField(record.data, 'name', 'Exercício');
              const metric = stringField(
                record.data,
                'trackingMetric',
                'repetitions',
              ) as ExerciseOption['trackingMetric'];
              const active = record.data.active !== false;
              return (
                <li key={record.entityId}>
                  <div>
                    <strong>{name}</strong>
                    <span>{trackingMetricLabel(metric)}</span>
                    <span>{active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <div className="button-row">
                    <button
                      aria-label={`Editar ${name}`}
                      type="button"
                      onClick={() => editExercise(record)}
                    >
                      Editar {name}
                    </button>
                    <button
                      aria-label={`${active ? 'Desativar' : 'Ativar'} ${name}`}
                      type="button"
                      onClick={() => void toggleExercise(record).catch(reportWriteFailure)}
                    >
                      {active ? 'Desativar' : 'Ativar'} {name}
                    </button>
                    <button
                      aria-label={`Excluir ${name}`}
                      className="danger"
                      type="button"
                      onClick={() => void deleteExercise(record).catch(reportWriteFailure)}
                    >
                      Excluir {name}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <form
            aria-label={editingExerciseId ? 'Editar exercício' : 'Novo exercício'}
            onSubmit={(event) => void saveExercise(event).catch(reportWriteFailure)}
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
            <div className="button-row">
              <button className="primary" type="submit">
                {editingExerciseId ? 'Salvar exercício' : 'Adicionar exercício'}
              </button>
              {editingExerciseId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingExerciseId(null);
                    setExerciseName('');
                  }}
                >
                  Cancelar edição
                </button>
              )}
            </div>
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
            <ul className="planning-management-list">
              {plans.map((plan) => {
                const name = stringField(plan.data, 'name', 'Plano');
                const template = templates.find(
                  (candidate) => candidate.data.planId === plan.entityId,
                );
                const type = stringField(template?.data ?? {}, 'type', 'other') as ActivityType;
                return (
                  <li key={plan.entityId}>
                    <div>
                      <strong>{name}</strong>
                      {template && <span>{stringField(template.data, 'name', 'Treino')}</span>}
                      <span>{activityTypeLabels[type]}</span>
                      <span>
                        {stringField(plan.data, 'status', 'active') === 'active'
                          ? 'Ativo'
                          : 'Inativo'}
                      </span>
                    </div>
                    <div className="button-row">
                      {template && (
                        <button
                          aria-label={`Editar ${name}`}
                          type="button"
                          onClick={() => editWeeklyPlan(plan, template)}
                        >
                          Editar {name}
                        </button>
                      )}
                      <button
                        aria-label={`Excluir ${name}`}
                        className="danger"
                        type="button"
                        onClick={() => void deleteWeeklyPlan(plan).catch(reportWriteFailure)}
                      >
                        Excluir {name}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <form
            className="weekly-plan-form"
            onSubmit={(event) => void savePlanning(event).catch(reportWriteFailure)}
          >
            <div className="weekly-plan-basics">
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
            </div>
            <div className="weekly-plan-exercises">
              {exerciseDrafts.map((draft, index) => (
                <fieldset className="exercise-draft-card" key={`${index}-${draft.exerciseId}`}>
                  <legend>Exercício {index + 1}</legend>
                  <label>
                    Exercício
                    <select
                      aria-label={`Exercício ${index + 1}`}
                      value={draft.exerciseId || defaultDraft(activityType, exercises).exerciseId}
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
                    Séries
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
                    Alvo por série
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
                      className="remove-exercise-button"
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
                  className="add-exercise-button"
                  type="button"
                  onClick={() =>
                    setExerciseDrafts((current) => [
                      ...current,
                      defaultDraft('strength', exercises),
                    ])
                  }
                >
                  Adicionar exercício ao treino
                </button>
              )}
            </div>
            <div className="weekly-plan-schedule">
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
            </div>
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
            <div className="button-row">
              <button className="primary" type="submit">
                {editingPlan ? 'Salvar alterações do plano' : 'Salvar planejamento'}
              </button>
              {editingPlan && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlan(null);
                    setPlanName('');
                    setTemplateName('');
                  }}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {activeArea === 'adhoc' && (
        <section className="card planning-section" aria-labelledby="adhoc-heading">
          <p className="eyebrow">Agenda</p>
          <h2 id="adhoc-heading">Sessões avulsas</h2>
          <AdHocSessionList
            sessions={adHocSessions}
            onEdit={editAdHocSession}
            onDelete={(session) => void deleteAdHocSession(session).catch(reportWriteFailure)}
          />
          <form onSubmit={(event) => void saveAdHocSession(event).catch(reportWriteFailure)}>
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
                    value={draft.exerciseId || defaultDraft(adHocType, exercises).exerciseId}
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
                  setAdHocExerciseDrafts((current) => [
                    ...current,
                    defaultDraft('strength', exercises),
                  ])
                }
              >
                Adicionar exercício à sessão
              </button>
            )}
            <div className="button-row">
              <button className="primary" type="submit">
                {editingAdHocId ? 'Salvar sessão avulsa' : 'Criar sessão avulsa'}
              </button>
              {editingAdHocId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAdHocId(null);
                    setAdHocName('');
                  }}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {activeArea === 'habits' && (
        <HabitManagement
          database={database}
          habitEntries={habitEntries}
          habits={habits}
          onChanged={async (nextMessage) => {
            setMessage(nextMessage);
            await refresh();
          }}
        />
      )}
    </main>
  );
}
