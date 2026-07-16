export type HistoryActivityType = 'other' | 'rest' | 'strength' | 'walk';
export type HistorySessionStatus =
  'cancelled' | 'completed' | 'in_progress' | 'missed' | 'partial' | 'planned';

export interface HistorySessionSummary {
  plannedLocalDate?: string;
  status: HistorySessionStatus;
  type: HistoryActivityType;
}

export interface HistoryFilters {
  activityTypes: HistoryActivityType[];
  pain: 'any' | 'with' | 'without';
  statuses: HistorySessionStatus[];
}

export interface CalendarDay {
  inMonth: boolean;
  localDate: string;
}

const DAY_MS = 86_400_000;

function parseCivilDate(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

function formatCivilDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function effectiveHistoryStatus(
  session: HistorySessionSummary,
  today: string,
): { derived: boolean; status: HistorySessionStatus } {
  if (
    session.status === 'planned' &&
    session.type !== 'rest' &&
    session.plannedLocalDate !== undefined &&
    session.plannedLocalDate < today
  ) {
    return { derived: true, status: 'missed' };
  }
  return { derived: false, status: session.status };
}

export function buildCalendarMonth(month: string): CalendarDay[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mês civil inválido.');
  const first = parseCivilDate(`${month}-01`);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first.getTime() - mondayOffset * DAY_MS);
  const nextMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1));
  const last = new Date(nextMonth.getTime() - DAY_MS);
  const sundayOffset = (7 - last.getUTCDay()) % 7;
  const gridEnd = new Date(last.getTime() + sundayOffset * DAY_MS);
  const days: CalendarDay[] = [];
  for (let cursor = gridStart.getTime(); cursor <= gridEnd.getTime(); cursor += DAY_MS) {
    const localDate = formatCivilDate(new Date(cursor));
    days.push({ inMonth: localDate.startsWith(month), localDate });
  }
  return days;
}

export function historyDayMatchesFilters(
  day: { hasPain: boolean; sessions: HistorySessionSummary[] },
  filters: HistoryFilters,
): boolean {
  const painMatches =
    filters.pain === 'any' ||
    (filters.pain === 'with' && day.hasPain) ||
    (filters.pain === 'without' && !day.hasPain);
  if (!painMatches) return false;
  if (filters.activityTypes.length === 0 && filters.statuses.length === 0) return true;
  return day.sessions.some(
    (session) =>
      (filters.activityTypes.length === 0 || filters.activityTypes.includes(session.type)) &&
      (filters.statuses.length === 0 || filters.statuses.includes(session.status)),
  );
}

export function monthBounds(month: string): { from: string; through: string } {
  const days = buildCalendarMonth(month).filter((day) => day.inMonth);
  return { from: days[0]!.localDate, through: days.at(-1)!.localDate };
}
