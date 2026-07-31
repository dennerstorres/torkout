import {
  buildCalendarMonth,
  effectiveHistoryStatus,
  historyDayMatchesFilters,
  monthBounds,
  type HistoryActivityType,
  type HistorySessionStatus,
} from '@torkout/domain';
import { useEffect, useMemo, useState } from 'react';

import {
  queueLocalMutation,
  type LocalRecord,
  type UserSyncDatabase,
} from '../sync/local-database';
import { useLocalRecords } from '../sync/use-local-records';

interface HistoryScreenProps {
  database: UserSyncDatabase;
  initialMonth?: string;
  onBack(): void;
  onLoadRange?(from: string, through: string): Promise<void>;
  today?: string;
}

interface DayRecords {
  habitEntries: LocalRecord[];
  measurements: LocalRecord[];
  painReports: LocalRecord[];
  sessions: LocalRecord[];
}

const activityLabels: Record<HistoryActivityType, string> = {
  other: 'Outro',
  rest: 'Descanso',
  strength: 'Força',
  walk: 'Caminhada',
};
const statusLabels: Record<HistorySessionStatus, string> = {
  cancelled: 'Cancelado',
  completed: 'Concluído',
  in_progress: 'Em andamento',
  missed: 'Perdido',
  partial: 'Parcial',
  planned: 'Planejado',
};
const regionLabels: Record<string, string> = {
  ankle: 'tornozelo',
  arm: 'braço',
  back: 'costas',
  foot: 'pé',
  knee: 'joelho',
  other: 'outra região',
  shoulder: 'ombro',
  thigh: 'coxa',
};

function stringField(record: LocalRecord, key: string, fallback = ''): string {
  return typeof record.data[key] === 'string' ? record.data[key] : fallback;
}

function nullableNumber(record: LocalRecord, key: string): number | null {
  return typeof record.data[key] === 'number' ? record.data[key] : null;
}

type LoggableSet = {
  id: string;
  setNumber: number;
  plannedRepetitions: number | null;
  actualRepetitions: number | null;
  completed: boolean;
};
type LoggableExercise = { id: string; name: string; sets: LoggableSet[] };

function loggableExercises(session: LocalRecord): LoggableExercise[] {
  const raw = session.data.exercises;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const exercise = entry as Record<string, unknown>;
    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
    return {
      id: String(exercise.id ?? ''),
      name: String(exercise.name ?? 'Exercício'),
      sets: sets.map((item) => {
        const set = item as Record<string, unknown>;
        return {
          actualRepetitions:
            typeof set.actualRepetitions === 'number' ? set.actualRepetitions : null,
          completed: set.completed === true,
          id: String(set.id ?? ''),
          plannedRepetitions:
            typeof set.plannedRepetitions === 'number' ? set.plannedRepetitions : null,
          setNumber: typeof set.setNumber === 'number' ? set.setNumber : 1,
        };
      }),
    };
  });
}

function dateLabel(localDate: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
    year: 'numeric',
    ...options,
  }).format(new Date(`${localDate}T12:00:00Z`));
}

function moveMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year!, monthNumber! - 1 + amount, 1)).toISOString().slice(0, 7);
}

function emptyDay(): DayRecords {
  return { habitEntries: [], measurements: [], painReports: [], sessions: [] };
}

export function HistoryScreen({
  database,
  initialMonth = new Date().toISOString().slice(0, 7),
  onBack,
  onLoadRange,
  today = new Date().toISOString().slice(0, 10),
}: HistoryScreenProps) {
  const [month, setMonth] = useState(initialMonth);
  const [storedRecords] = useLocalRecords(database);
  const records = useMemo(
    () => storedRecords.filter((record) => record.deletedAt === null),
    [storedRecords],
  );
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    today.startsWith(initialMonth) ? today : `${initialMonth}-01`,
  );
  const [activityFilter, setActivityFilter] = useState<HistoryActivityType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<HistorySessionStatus | 'all'>('all');
  const [painFilter, setPainFilter] = useState<'any' | 'with' | 'without'>('any');
  const [filtersOpen, setFiltersOpen] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 48rem)').matches
      : false,
  );
  const [message, setMessage] = useState('Histórico disponível neste dispositivo.');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const bounds = monthBounds(month);
      try {
        await onLoadRange?.(bounds.from, bounds.through);
        if (active) {
          setMessage(
            onLoadRange
              ? 'Histórico atualizado e disponível offline.'
              : 'Histórico disponível neste dispositivo.',
          );
          setLoaded(true);
        }
      } catch {
        if (active) {
          setMessage('Sem conexão. Exibindo o histórico salvo neste dispositivo.');
          setLoaded(true);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [month, onLoadRange]);

  const habits = useMemo(
    () =>
      records.filter(
        (record) => record.entityType === 'habit_definition' && record.deletedAt === null,
      ),
    [records],
  );

  const recordsByDay = useMemo(() => {
    const result = new Map<string, DayRecords>();
    for (const record of records) {
      const date =
        record.entityType === 'workout_session'
          ? stringField(record, 'plannedLocalDate')
          : record.entityType === 'habit_entry' ||
              record.entityType === 'pain_report' ||
              record.entityType === 'body_measurement'
            ? stringField(record, 'localDate')
            : '';
      if (!date) continue;
      const day = result.get(date) ?? emptyDay();
      if (record.entityType === 'workout_session') day.sessions.push(record);
      if (record.entityType === 'habit_entry') day.habitEntries.push(record);
      if (record.entityType === 'pain_report') day.painReports.push(record);
      if (record.entityType === 'body_measurement') day.measurements.push(record);
      result.set(date, day);
    }
    return result;
  }, [records]);

  const calendarDays = buildCalendarMonth(month);
  const selected = recordsByDay.get(selectedDate) ?? emptyDay();
  const activeFilterCount = [
    activityFilter !== 'all',
    statusFilter !== 'all',
    painFilter !== 'any',
  ].filter(Boolean).length;

  function sessionSummary(session: LocalRecord) {
    const type = stringField(session, 'type', 'other') as HistoryActivityType;
    const effective = effectiveHistoryStatus(
      {
        plannedLocalDate: stringField(session, 'plannedLocalDate'),
        status: stringField(session, 'status', 'planned') as HistorySessionStatus,
        type,
      },
      today,
    );
    return { ...effective, type };
  }

  /**
   * WORKOUT-011: só data local já encerrada, e só sessão que tem execução a lançar.
   * Descanso não exige execução, então não oferece lançamento.
   */
  function canLogRetroactively(session: LocalRecord): boolean {
    const plannedLocalDate = stringField(session, 'plannedLocalDate');
    if (!plannedLocalDate || plannedLocalDate > today) return false;
    if (stringField(session, 'type', 'other') === 'rest') return false;
    return loggableExercises(session).length > 0;
  }

  function dayMatches(day: DayRecords): boolean {
    return historyDayMatchesFilters(
      {
        hasPain: day.painReports.length > 0,
        sessions: day.sessions.map((session) => {
          const summary = sessionSummary(session);
          return { status: summary.status, type: summary.type };
        }),
      },
      {
        activityTypes: activityFilter === 'all' ? [] : [activityFilter],
        pain: painFilter,
        statuses: statusFilter === 'all' ? [] : [statusFilter],
      },
    );
  }

  async function updateRecord(record: LocalRecord, payload: Record<string, unknown>) {
    await queueLocalMutation(database, {
      entityId: record.entityId,
      entityType: record.entityType,
      operation: 'update',
      payload,
    });
    setMessage('Alteração histórica salva localmente e pendente de sincronização.');
  }

  return (
    <main className="history-layout">
      <header className="planning-header history-header">
        <div>
          <p className="eyebrow">Calendário e histórico</p>
          <h1>Histórico</h1>
        </div>
        <button type="button" onClick={onBack}>
          Voltar
        </button>
      </header>

      <p className="sync-note" role="status">
        {message}
      </p>

      <section className="card history-calendar" aria-label="Calendário mensal">
        <div aria-label="Navegação mensal" className="calendar-actions" role="group">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            ‹
          </button>
          <h2>
            {dateLabel(`${month}-01`, {
              day: undefined,
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setMonth(moveMonth(month, 1))}
          >
            ›
          </button>
        </div>
        <button
          aria-expanded={filtersOpen}
          className="history-filter-toggle"
          type="button"
          onClick={() => setFiltersOpen((current) => !current)}
        >
          {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
          {activeFilterCount > 0
            ? ` · ${activeFilterCount} ativo${activeFilterCount > 1 ? 's' : ''}`
            : ''}
        </button>
        {filtersOpen && (
          <fieldset className="history-filters">
            <legend>Filtros do calendário</legend>
            <label>
              Filtrar por atividade
              <select
                value={activityFilter}
                onChange={(event) => setActivityFilter(event.target.value as typeof activityFilter)}
              >
                <option value="all">Todas</option>
                {Object.entries(activityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filtrar por estado
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              >
                <option value="all">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Filtrar por dor
              <select
                value={painFilter}
                onChange={(event) => setPainFilter(event.target.value as typeof painFilter)}
              >
                <option value="any">Com ou sem dor</option>
                <option value="with">Com relato de dor</option>
                <option value="without">Sem relato de dor</option>
              </select>
            </label>
          </fieldset>
        )}
        <div className="calendar-weekdays" aria-hidden="true">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        {!loaded && (
          <>
            <p className="visually-hidden" aria-live="polite">
              Carregando histórico…
            </p>
            <div className="calendar-grid calendar-grid--loading" aria-hidden="true">
              {calendarDays.map((calendarDay) => (
                <button
                  className="calendar-day skeleton-day"
                  disabled
                  key={calendarDay.localDate}
                  tabIndex={-1}
                  type="button"
                />
              ))}
            </div>
          </>
        )}
        {loaded && (
          <div className="calendar-grid">
            {calendarDays.map((calendarDay) => {
              const day = recordsByDay.get(calendarDay.localDate) ?? emptyDay();
              const matches = dayMatches(day);
              const hasPending = [
                ...day.sessions,
                ...day.habitEntries,
                ...day.measurements,
                ...day.painReports,
              ].some(
                (record) => record.syncStatus === 'pending' || record.syncStatus === 'saved-local',
              );
              const hasConflict = [
                ...day.sessions,
                ...day.habitEntries,
                ...day.measurements,
                ...day.painReports,
              ].some((record) => record.syncStatus === 'conflict');
              return (
                <button
                  aria-current={calendarDay.localDate === selectedDate ? 'date' : undefined}
                  aria-label={dateLabel(calendarDay.localDate, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  className={`calendar-day${calendarDay.inMonth ? '' : ' outside-month'}`}
                  data-filtered-out={matches ? undefined : 'true'}
                  key={calendarDay.localDate}
                  type="button"
                  onClick={() => setSelectedDate(calendarDay.localDate)}
                >
                  <span className="calendar-number">{Number(calendarDay.localDate.slice(-2))}</span>
                  {day.sessions.slice(0, 2).map((session) => {
                    const summary = sessionSummary(session);
                    return (
                      <span className="calendar-badge-group" key={session.entityId}>
                        <span className="badge activity-badge">{activityLabels[summary.type]}</span>
                        <span className="badge status-badge">
                          {statusLabels[summary.status]}
                          {summary.derived ? ' (derivado)' : ''}
                        </span>
                      </span>
                    );
                  })}
                  {day.sessions.length > 2 && (
                    <span className="badge more-badge">
                      +{day.sessions.length - 2}{' '}
                      {day.sessions.length - 2 === 1 ? 'registro' : 'registros'}
                    </span>
                  )}
                  {day.painReports.length > 0 && (
                    <span className="badge pain-badge">Dor relatada</span>
                  )}
                  {hasPending && <span className="badge sync-badge">Pendente</span>}
                  {hasConflict && <span className="badge conflict-badge">Conflito</span>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="card history-detail" aria-labelledby="history-detail-heading">
        <h2 id="history-detail-heading">Detalhes de {dateLabel(selectedDate)}</h2>
        {selected.sessions.length === 0 &&
          selected.habitEntries.length === 0 &&
          selected.measurements.length === 0 &&
          selected.painReports.length === 0 && <p>Nenhum registro para esta data.</p>}

        {selected.sessions.map((session) => {
          const name = stringField(session, 'templateNameSnapshot', 'Sessão');
          const summary = sessionSummary(session);
          return (
            <article className="history-record" key={session.entityId}>
              <h3>{name}</h3>
              <p>
                Tipo: {activityLabels[summary.type]} · Estado: {statusLabels[summary.status]}
                {summary.derived ? ' (derivado)' : ''}
              </p>
              {stringField(session, 'retroactivelyLoggedAt') !== '' && (
                <p className="history-retroactive">
                  <span aria-hidden="true">↩ </span>
                  Lançado depois da data, em{' '}
                  {dateLabel(stringField(session, 'retroactivelyLoggedAt').slice(0, 10))}.
                </p>
              )}
              {canLogRetroactively(session) && (
                <RetroactiveLogger
                  dateLabelText={dateLabel(selectedDate)}
                  onSubmit={(execution) => void updateRecord(session, { execution })}
                  session={session}
                />
              )}
              {summary.derived && (
                <button
                  type="button"
                  onClick={() => void updateRecord(session, { status: 'missed' })}
                >
                  Confirmar como perdido
                </button>
              )}
              <label>
                Estado de {name}
                <select
                  defaultValue={stringField(session, 'status', 'planned')}
                  onChange={(event) => void updateRecord(session, { status: event.target.value })}
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Observações de {name}
                <textarea
                  defaultValue={stringField(session, 'notes')}
                  onBlur={(event) =>
                    void updateRecord(session, { notes: event.target.value || null })
                  }
                />
              </label>
            </article>
          );
        })}

        {selected.habitEntries.length > 0 && <h3>Hábitos</h3>}
        {selected.habitEntries.map((entry) => {
          const definition = habits.find(
            (habit) => habit.entityId === stringField(entry, 'habitDefinitionId'),
          );
          if (!definition) return null;
          const name = stringField(definition, 'name', 'Hábito');
          const type = stringField(definition, 'type', 'quantity');
          const options = Array.isArray(definition.data.options)
            ? (definition.data.options as Array<{ id: string; label: string }>)
            : [];
          if (type === 'boolean') {
            return (
              <label className="inline-check history-record" key={entry.entityId}>
                <input
                  defaultChecked={entry.data.booleanValue === true}
                  type="checkbox"
                  onChange={(event) =>
                    void updateRecord(entry, {
                      booleanValue: event.target.checked,
                      numericValue: null,
                      selectedOptionId: null,
                      textValue: null,
                    })
                  }
                />
                {name}
              </label>
            );
          }
          if (type === 'choice') {
            return (
              <label className="history-record" key={entry.entityId}>
                {name}
                <select
                  defaultValue={stringField(entry, 'selectedOptionId')}
                  onChange={(event) =>
                    void updateRecord(entry, {
                      booleanValue: null,
                      numericValue: null,
                      selectedOptionId: event.target.value,
                      textValue: null,
                    })
                  }
                >
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <label className="history-record" key={entry.entityId}>
              {name}
              <input
                defaultValue={nullableNumber(entry, 'numericValue') ?? ''}
                min="0"
                type="number"
                onBlur={(event) =>
                  event.target.value &&
                  void updateRecord(entry, {
                    booleanValue: null,
                    numericValue: Number(event.target.value),
                    selectedOptionId: null,
                    textValue: null,
                  })
                }
              />
            </label>
          );
        })}

        {selected.measurements.length > 0 && <h3>Medidas</h3>}
        {selected.measurements.map((measurement) => (
          <div className="history-record history-fields" key={measurement.entityId}>
            <label>
              Peso em {dateLabel(selectedDate)}
              <input
                defaultValue={nullableNumber(measurement, 'weightKg') ?? ''}
                min="0"
                step="0.1"
                type="number"
                onBlur={(event) => {
                  const value = event.target.value;
                  if (value || measurement.data.waistCm != null) {
                    void updateRecord(measurement, { weightKg: value ? Number(value) : null });
                  }
                }}
              />
            </label>
            <label>
              Cintura em {dateLabel(selectedDate)}
              <input
                defaultValue={nullableNumber(measurement, 'waistCm') ?? ''}
                min="0"
                step="0.1"
                type="number"
                onBlur={(event) => {
                  const value = event.target.value;
                  if (value || measurement.data.weightKg != null) {
                    void updateRecord(measurement, { waistCm: value ? Number(value) : null });
                  }
                }}
              />
            </label>
            {Array.isArray(measurement.data.additionalMeasurements) &&
              (
                measurement.data.additionalMeasurements as Array<{
                  key: string;
                  label: string;
                  unit: string;
                  value: number;
                }>
              ).map((additional, index, all) => (
                <label key={`${additional.key}-${index}`}>
                  {additional.label} ({additional.unit}) em {dateLabel(selectedDate)}
                  <input
                    defaultValue={additional.value}
                    min="0.1"
                    step="0.1"
                    type="number"
                    onBlur={(event) => {
                      if (!event.target.value) return;
                      void updateRecord(measurement, {
                        additionalMeasurements: all.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, value: Number(event.target.value) }
                            : item,
                        ),
                      });
                    }}
                  />
                </label>
              ))}
          </div>
        ))}

        {selected.painReports.length > 0 && <h3>Dores</h3>}
        {selected.painReports.map((pain) => {
          const region =
            regionLabels[stringField(pain, 'bodyRegion')] ?? stringField(pain, 'bodyRegion');
          return (
            <div className="history-record history-fields" key={pain.entityId}>
              <label>
                Intensidade da dor em {region}
                <select
                  defaultValue={stringField(pain, 'intensity', 'not_informed')}
                  onChange={(event) => void updateRecord(pain, { intensity: event.target.value })}
                >
                  <option value="not_informed">Não informada</option>
                  <option value="light">Leve</option>
                  <option value="moderate">Moderada</option>
                  <option value="strong">Forte</option>
                </select>
              </label>
              <label>
                Observações da dor em {region}
                <textarea
                  defaultValue={stringField(pain, 'notes')}
                  onBlur={(event) => void updateRecord(pain, { notes: event.target.value || null })}
                />
              </label>
            </div>
          );
        })}
      </section>
    </main>
  );
}

interface RetroactiveLoggerProps {
  dateLabelText: string;
  onSubmit(execution: Record<string, unknown>): void;
  session: LocalRecord;
}

/**
 * Lançamento retroativo: preenche a execução de um treino cuja data já passou.
 * O servidor decide e grava a marca de retroatividade; a tela nunca a inventa.
 */
function RetroactiveLogger({ dateLabelText, onSubmit, session }: RetroactiveLoggerProps) {
  // As séries ficam em estado porque o lançamento pode acrescentar séries além do
  // plano; série acrescentada nasce sem alvo, para não inventar um planejamento.
  const [exercises, setExercises] = useState<LoggableExercise[]>(() => loggableExercises(session));

  function updateSet(exerciseId: string, setId: string, actualRepetitions: number | null): void {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId ? { ...set, actualRepetitions } : set,
              ),
            }
          : exercise,
      ),
    );
  }

  function addSet(exerciseId: string): void {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: [
                ...exercise.sets,
                {
                  actualRepetitions: null,
                  completed: false,
                  id: crypto.randomUUID(),
                  plannedRepetitions: null,
                  setNumber: Math.max(0, ...exercise.sets.map((set) => set.setNumber)) + 1,
                },
              ],
            }
          : exercise,
      ),
    );
  }

  function removeSet(exerciseId: string, setId: string): void {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
          : exercise,
      ),
    );
  }

  return (
    <div className="history-retroactive-form">
      <h4>Lançar execução</h4>
      <p className="field-hint">
        Use quando não foi possível registrar no dia. O treino conta como realizado e fica marcado
        como lançado depois.
      </p>
      {exercises.map((exercise) => (
        <fieldset className="history-retroactive-exercise" key={exercise.id}>
          <legend>{exercise.name}</legend>
          {exercise.sets.map((set) => (
            <div className="history-retroactive-set" key={set.id}>
              <label>
                {`${exercise.name} · série ${set.setNumber} em ${dateLabelText}`}
                <input
                  inputMode="numeric"
                  min={0}
                  aria-label={`${exercise.name} · série ${set.setNumber} em ${dateLabelText}`}
                  type="number"
                  value={set.actualRepetitions ?? ''}
                  onChange={(event) =>
                    updateSet(
                      exercise.id,
                      set.id,
                      event.target.value === '' ? null : Number(event.target.value),
                    )
                  }
                />
                {set.plannedRepetitions === null ? (
                  <span className="field-hint">Sem alvo planejado.</span>
                ) : (
                  <span className="field-hint">Planejado: {set.plannedRepetitions}.</span>
                )}
              </label>
              {set.plannedRepetitions === null && (
                <button type="button" onClick={() => removeSet(exercise.id, set.id)}>
                  {`Remover série ${set.setNumber} de ${exercise.name}`}
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addSet(exercise.id)}>
            {`Adicionar série em ${exercise.name}`}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() =>
          onSubmit({
            exercises: exercises.map((exercise) => ({
              id: exercise.id,
              sets: exercise.sets.map((set) => ({
                actualRepetitions: set.actualRepetitions,
                completed: (set.actualRepetitions ?? 0) > 0,
                id: set.id,
                setNumber: set.setNumber,
              })),
              status: 'completed',
            })),
          })
        }
      >
        {`Lançar treino de ${dateLabelText}`}
      </button>
    </div>
  );
}
