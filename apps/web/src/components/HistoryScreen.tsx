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
  strength: 'ForÃ§a',
  walk: 'Caminhada',
};
const statusLabels: Record<HistorySessionStatus, string> = {
  cancelled: 'Cancelado',
  completed: 'ConcluÃ­do',
  in_progress: 'Em andamento',
  missed: 'Perdido',
  partial: 'Parcial',
  planned: 'Planejado',
};
const regionLabels: Record<string, string> = {
  ankle: 'tornozelo',
  arm: 'braÃ§o',
  back: 'costas',
  foot: 'pÃ©',
  knee: 'joelho',
  other: 'outra regiÃ£o',
  shoulder: 'ombro',
  thigh: 'coxa',
};

function stringField(record: LocalRecord, key: string, fallback = ''): string {
  return typeof record.data[key] === 'string' ? record.data[key] : fallback;
}

function nullableNumber(record: LocalRecord, key: string): number | null {
  return typeof record.data[key] === 'number' ? record.data[key] : null;
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
  const [records, setRecords] = useState<LocalRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    today.startsWith(initialMonth) ? today : `${initialMonth}-01`,
  );
  const [activityFilter, setActivityFilter] = useState<HistoryActivityType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<HistorySessionStatus | 'all'>('all');
  const [painFilter, setPainFilter] = useState<'any' | 'with' | 'without'>('any');
  const [message, setMessage] = useState('HistÃ³rico disponÃ­vel neste dispositivo.');

  async function refresh(): Promise<void> {
    setRecords(await database.records.filter((record) => record.deletedAt === null).toArray());
  }

  useEffect(() => {
    let active = true;
    const load = async () => {
      const bounds = monthBounds(month);
      try {
        await onLoadRange?.(bounds.from, bounds.through);
        if (active) {
          setRecords(
            await database.records.filter((record) => record.deletedAt === null).toArray(),
          );
          setMessage(
            onLoadRange
              ? 'HistÃ³rico atualizado e disponÃ­vel offline.'
              : 'HistÃ³rico disponÃ­vel neste dispositivo.',
          );
          setLoaded(true);
        }
      } catch {
        if (active) {
          setRecords(
            await database.records.filter((record) => record.deletedAt === null).toArray(),
          );
          setMessage('Sem conexÃ£o. Exibindo o histÃ³rico salvo neste dispositivo.');
          setLoaded(true);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [database, month, onLoadRange]);

  const habits = useMemo(
    () =>
      records.filter(
        (record) => record.entityType === 'habit_definition' && record.data.active !== false,
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
    setMessage('AlteraÃ§Ã£o histÃ³rica salva localmente e pendente de sincronizaÃ§Ã£o.');
    await refresh();
  }

  return (
    <main className="history-layout">
      <header className="planning-header history-header">
        <div>
          <p className="eyebrow">CalendÃ¡rio e histÃ³rico</p>
          <h1>
            {dateLabel(`${month}-01`, {
              day: undefined,
              month: 'long',
              year: 'numeric',
            })}
          </h1>
        </div>
        <button type="button" onClick={onBack}>
          Voltar
        </button>
      </header>

      <p className="sync-note" role="status">
        {message}
      </p>

      <section className="card history-calendar" aria-label="CalendÃ¡rio mensal">
        <div className="calendar-actions">
          <button
            type="button"
            aria-label="MÃªs anterior"
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            â€¹
          </button>
          <button
            type="button"
            aria-label="PrÃ³ximo mÃªs"
            onClick={() => setMonth(moveMonth(month, 1))}
          >
            â€º
          </button>
        </div>
        <div className="history-filters">
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
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'SÃ¡b', 'Dom'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        {!loaded && <p aria-live="polite">Carregando histÃ³ricoâ€¦</p>}
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
                  {day.sessions.map((session) => {
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
          const name = stringField(session, 'templateNameSnapshot', 'SessÃ£o');
          const summary = sessionSummary(session);
          return (
            <article className="history-record" key={session.entityId}>
              <h3>{name}</h3>
              <p>
                Tipo: {activityLabels[summary.type]} Â· Estado: {statusLabels[summary.status]}
                {summary.derived ? ' (derivado)' : ''}
              </p>
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
                ObservaÃ§Ãµes de {name}
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

        {selected.habitEntries.length > 0 && <h3>HÃ¡bitos</h3>}
        {selected.habitEntries.map((entry) => {
          const definition = habits.find(
            (habit) => habit.entityId === stringField(entry, 'habitDefinitionId'),
          );
          if (!definition) return null;
          const name = stringField(definition, 'name', 'HÃ¡bito');
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
                  <option value="not_informed">NÃ£o informada</option>
                  <option value="light">Leve</option>
                  <option value="moderate">Moderada</option>
                  <option value="strong">Forte</option>
                </select>
              </label>
              <label>
                ObservaÃ§Ãµes da dor em {region}
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
