import { entityKey, type LocalRecord } from '../sync/local-database';

/**
 * Semente do modo demonstração. Reproduz o plano de referência de `docs/GUIA_DO_USUARIO.md`, que já
 * é fictício e existe justamente como exemplo de cadastro. Nenhum dado descreve pessoa real.
 *
 * As datas são relativas ao dia da visita, para que Hoje, Histórico e Progresso tenham conteúdo sem
 * depender de quando a demonstração foi escrita.
 */

/** Constrói um UUID válido e estável a partir de um prefixo curto e um índice. */
function demoId(group: number, index: number): string {
  const suffix = index.toString(16).padStart(12, '0');
  return `dcd${group.toString(16).padStart(5, '0')}-0000-4000-8000-${suffix}`;
}

function isoDate(base: Date, dayOffset: number): string {
  const date = new Date(base);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

function record(
  entityType: LocalRecord['entityType'],
  entityId: string,
  data: Record<string, unknown>,
  updatedAt: string,
): LocalRecord {
  return {
    data: { ...data, id: entityId, version: 1 },
    deletedAt: null,
    entityId,
    entityType,
    key: entityKey(entityType, entityId),
    syncStatus: 'synced',
    updatedAt,
    version: 1,
  };
}

const HABITS = [
  { name: 'Café', options: ['Não consumi', 'Sem açúcar', 'Com açúcar'] },
  { name: 'Arroz', options: ['Não consumi', 'Reduzido', 'Habitual'] },
  { name: 'Proteína', options: ['Não', 'Uma porção', 'Duas porções'] },
  { name: 'Salada', options: ['Não', 'Sim'] },
];

const STRENGTH_EXERCISES = [
  { metric: 'repetitions' as const, name: 'Flexão', reps: 12, sets: 3 },
  { metric: 'repetitions' as const, name: 'Agachamento livre', reps: 15, sets: 3 },
];

/** Dias da semana ISO em que o plano de referência prevê força (terça, quinta, sábado). */
const STRENGTH_WEEKDAYS = new Set([2, 4, 6]);
/** Caminhada nos demais dias úteis; domingo é descanso. */
const WALK_WEEKDAYS = new Set([1, 3, 5]);

function isoWeekday(localDate: string): number {
  const day = new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function buildSession(localDate: string, index: number, completed: boolean): LocalRecord {
  const weekday = isoWeekday(localDate);
  const sessionId = demoId(1, index);
  const updatedAt = `${localDate}T21:00:00.000Z`;

  if (WALK_WEEKDAYS.has(weekday)) {
    return record(
      'workout_session',
      sessionId,
      {
        exercises: [
          {
            id: demoId(2, index * 10),
            name: 'Caminhada',
            notes: null,
            sets: [
              {
                actualDurationMinutes: completed ? 32 : null,
                completed,
                id: demoId(3, index * 10),
                plannedDurationMinutes: 30,
                setNumber: 1,
              },
            ],
            status: completed ? 'completed' : 'planned',
            trackingMetric: 'duration',
          },
        ],
        jointPainStatus: completed ? 'none' : 'unknown',
        plannedLocalDate: localDate,
        status: completed ? 'completed' : 'planned',
        templateNameSnapshot: 'Caminhada leve',
        type: 'walk',
      },
      updatedAt,
    );
  }

  if (!STRENGTH_WEEKDAYS.has(weekday)) {
    return record(
      'workout_session',
      sessionId,
      {
        exercises: [],
        jointPainStatus: 'unknown',
        plannedLocalDate: localDate,
        status: completed ? 'completed' : 'planned',
        templateNameSnapshot: 'Descanso',
        type: 'rest',
      },
      updatedAt,
    );
  }

  return record(
    'workout_session',
    sessionId,
    {
      exercises: STRENGTH_EXERCISES.map((exercise, exerciseIndex) => ({
        id: demoId(2, index * 10 + exerciseIndex),
        name: exercise.name,
        notes: null,
        sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
          actualRepetitions: completed ? exercise.reps : null,
          completed,
          id: demoId(3, index * 10 + exerciseIndex * 3 + setIndex),
          plannedRepetitions: exercise.reps,
          setNumber: setIndex + 1,
        })),
        status: completed ? 'completed' : 'planned',
        trackingMetric: exercise.metric,
      })),
      jointPainStatus: completed ? 'none' : 'unknown',
      plannedLocalDate: localDate,
      status: completed ? 'completed' : 'planned',
      templateNameSnapshot: 'Treino A',
      type: 'strength',
    },
    updatedAt,
  );
}

/** Quantos dias de histórico a demonstração traz, para que os indicadores tenham o que mostrar. */
const HISTORY_DAYS = 28;

export function buildDemoRecords(today = new Date()): LocalRecord[] {
  const records: LocalRecord[] = [];

  HABITS.forEach((habit, habitIndex) => {
    const habitId = demoId(4, habitIndex);
    records.push(
      record(
        'habit_definition',
        habitId,
        {
          active: true,
          name: habit.name,
          options: habit.options.map((label, optionIndex) => ({
            id: demoId(5, habitIndex * 10 + optionIndex),
            label,
            sortOrder: optionIndex,
            stableValue: `option_${optionIndex}`,
          })),
          sortOrder: habitIndex,
          type: 'choice',
        },
        `${isoDate(today, -HISTORY_DAYS)}T12:00:00.000Z`,
      ),
    );
  });

  for (let offset = -HISTORY_DAYS; offset <= 0; offset += 1) {
    const localDate = isoDate(today, offset);
    const index = offset + HISTORY_DAYS;
    // O dia da visita fica planejado, para que o visitante tenha o que registrar em Hoje.
    records.push(buildSession(localDate, index, offset < 0));

    if (offset % 7 === 0) {
      const weekIndex = Math.abs(Math.trunc(offset / 7));
      records.push(
        record(
          'body_measurement',
          demoId(6, index),
          {
            localDate,
            measuredAt: `${localDate}T09:00:00.000Z`,
            note: null,
            waistCm: 92 - weekIndex * 0.5,
            weightKg: 82 - weekIndex * 0.4,
          },
          `${localDate}T09:00:00.000Z`,
        ),
      );
    }
  }

  return records;
}
