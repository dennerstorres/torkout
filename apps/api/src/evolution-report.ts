import type { DataExport, PendingExportChange } from '@torkout/contracts';
import {
  ADHERENCE_EXPLANATION,
  calculateAdherence,
  coffeeStatusLabel,
  evaluateLevels,
  recoveryDeservesAttention,
  RECOVERY_ATTENTION_NOTICE,
  type AdherenceBreakdown,
  type AdherenceSessionInput,
  type CoffeeStatus,
} from '@torkout/domain';

type Row = Record<string, unknown>;
type CollectionName = keyof DataExport['entities'];

const NOT_RECORDED = 'não registrado';
const DAY_MS = 86_400_000;

const pendingCollections: Partial<Record<PendingExportChange['entityType'], CollectionName>> = {
  body_measurement: 'bodyMeasurements',
  coffee_intake: 'coffeeIntakes',
  exercise: 'exercises',
  habit_definition: 'habitDefinitions',
  habit_entry: 'habitEntries',
  pain_report: 'painReports',
  training_plan: 'trainingPlans',
  whey_intake: 'wheyIntakes',
  workout_session: 'workoutSessions',
  workout_template: 'workoutTemplates',
};

const WEEKDAY_LABELS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];

const BODY_REGION_LABELS: Record<string, string> = {
  abdomen: 'Abdômen',
  ankle: 'Tornozelo',
  arm: 'Braço',
  back: 'Costas',
  chest: 'Peito',
  elbow: 'Cotovelo',
  foot: 'Pé',
  hand: 'Mão',
  hip: 'Quadril',
  knee: 'Joelho',
  leg: 'Perna',
  neck: 'Pescoço',
  shoulder: 'Ombro',
  thigh: 'Coxa',
  wrist: 'Punho',
};

const PAIN_MOMENT_LABELS: Record<string, string> = {
  after: 'Depois do exercício',
  before: 'Antes do exercício',
  during: 'Durante o exercício',
  next_day: 'No dia seguinte',
};

const PAIN_INTENSITY_LABELS: Record<string, string> = {
  light: 'Leve',
  moderate: 'Moderada',
  not_informed: 'Não informada',
  strong: 'Forte',
};

const WHEY_MIX_LABELS: Record<string, string> = {
  other: 'Outro',
  semi_skimmed_milk: 'Leite semidesnatado',
  skimmed_milk: 'Leite desnatado',
  water: 'Água',
  whole_milk: 'Leite integral',
};

const WHEY_MOMENT_LABELS: Record<string, string> = {
  morning: 'Manhã',
  night: 'Noite',
  other: 'Outro',
  post_workout: 'Depois do treino',
  pre_workout: 'Antes do treino',
};

const WHEY_TOLERANCE_LABELS: Record<string, string> = {
  bloating: 'Estufamento',
  cramp: 'Cólica',
  diarrhea: 'Diarreia',
  gas: 'Gases',
  nausea: 'Náusea',
  none: 'Sem desconforto',
  other: 'Outro',
};

const PHOTO_POSE_LABELS: Record<string, string> = {
  back: 'Costas',
  front: 'Frente',
  side: 'Lado',
};

const ACTIVITY_LABELS: Record<string, string> = {
  other: 'Outra atividade',
  rest: 'Descanso',
  strength: 'Força',
  walk: 'Caminhada',
};

const SESSION_STATUS_LABELS: Record<string, string> = {
  cancelled: 'Cancelada',
  completed: 'Concluída',
  in_progress: 'Em andamento',
  missed: 'Perdida',
  partial: 'Parcial',
  planned: 'Planejada',
};

function text(value: unknown): string {
  return value === null || value === undefined || value === '' ? NOT_RECORDED : String(value);
}

function label(dictionary: Record<string, string>, value: unknown): string {
  const key = typeof value === 'string' ? value : '';
  return dictionary[key] ?? (key ? key : NOT_RECORDED);
}

function cell(value: unknown): string {
  return text(value).replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function value(input: unknown, unit?: string): string {
  const parsed = number(input);
  return parsed === null ? NOT_RECORDED : `${parsed}${unit ? ` ${unit}` : ''}`;
}

function decimal(input: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(input);
}

function date(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(input);
  return match?.[1] ?? null;
}

function clock(input: unknown): string {
  if (typeof input !== 'string') return NOT_RECORDED;
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(input);
  return match ? `${match[1]}:${match[2]}` : NOT_RECORDED;
}

function boolText(input: unknown): string {
  if (input === true) return 'sim';
  if (input === false) return 'não';
  return NOT_RECORDED;
}

function normalized(input: unknown): string {
  return String(input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function current(rows: Row[]): Row[] {
  return rows.filter((row) => row.deletedAt == null);
}

function table(headers: string[], rows: unknown[][]): string[] {
  if (rows.length === 0) return [NOT_RECORDED];
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
  ];
}

function applyPending(data: DataExport): DataExport['entities'] {
  const result = Object.fromEntries(
    Object.entries(data.entities).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
  ) as DataExport['entities'];

  for (const change of [...data.pendingChanges].sort((left, right) =>
    left.clientOccurredAt.localeCompare(right.clientOccurredAt),
  )) {
    const collection = pendingCollections[change.entityType];
    if (!collection) continue;
    const rows = result[collection];
    const index = rows.findIndex((row) => row.id === change.entityId);
    if (change.operation === 'delete') {
      if (index >= 0) rows.splice(index, 1);
      continue;
    }
    const existing = index >= 0 ? rows[index]! : { id: change.entityId };
    const merged = { ...existing, ...change.payload, id: change.entityId, pendingLocal: true };
    if (index >= 0) rows[index] = merged;
    else rows.push(merged);
  }
  return result;
}

function habitValue(entry: Row, options: Map<unknown, string>): string {
  if (entry.booleanValue !== null && entry.booleanValue !== undefined)
    return entry.booleanValue ? 'sim' : 'não';
  if (entry.numericValue !== null && entry.numericValue !== undefined)
    return String(number(entry.numericValue) ?? entry.numericValue);
  if (entry.textValue !== null && entry.textValue !== undefined) return text(entry.textValue);
  if (entry.selectedOptionId !== null && entry.selectedOptionId !== undefined)
    return options.get(entry.selectedOptionId) ?? NOT_RECORDED;
  return NOT_RECORDED;
}

function trend(rows: Row[], key: string, unit: string): string {
  const points = rows
    .map((row) => ({ localDate: date(row.localDate), value: number(row[key]) }))
    .filter((point): point is { localDate: string; value: number } =>
      Boolean(point.localDate && point.value !== null),
    )
    .sort((left, right) => left.localDate.localeCompare(right.localDate));
  if (points.length === 0) return NOT_RECORDED;
  if (points.length === 1)
    return `${points[0]!.value} ${unit} em ${points[0]!.localDate}; tendência: ${NOT_RECORDED}`;
  const first = points[0]!;
  const last = points.at(-1)!;
  const difference = Math.round((last.value - first.value) * 100) / 100;
  return `${first.value} ${unit} em ${first.localDate} → ${last.value} ${unit} em ${last.localDate} (variação ${difference >= 0 ? '+' : ''}${difference} ${unit})`;
}

function metricValue(set: Row, metric: unknown, planned: boolean): string {
  const prefix = planned ? 'planned' : 'actual';
  if (metric === 'duration')
    return value(
      set[`${prefix}DurationSeconds`] ?? (planned ? set.targetDurationSeconds : undefined),
      's',
    );
  if (metric === 'distance')
    return value(
      set[`${prefix}DistanceMeters`] ?? (planned ? set.targetDistanceMeters : undefined),
      'm',
    );
  return value(
    set[`${prefix}Repetitions`] ?? (planned ? set.targetRepetitions : undefined),
    'repetições',
  );
}

function exerciseRowsForSession(
  session: Row,
  sessionExercises: Row[],
  exerciseSets: Row[],
): Array<{ exercise: Row; sets: Row[] }> {
  const pendingExecution = session.execution as { exercises?: Row[] } | undefined;
  const plannedExercises = Array.isArray(session.exercises) ? (session.exercises as Row[]) : [];
  if (Array.isArray(pendingExecution?.exercises)) {
    return pendingExecution.exercises.map((execution) => {
      const persisted = sessionExercises.find((item) => item.id === execution.id) ?? {};
      const planned = plannedExercises.find((item) => item.id === execution.id) ?? persisted;
      const plannedSets = Array.isArray(planned.sets)
        ? (planned.sets as Row[])
        : exerciseSets.filter((set) => set.sessionExerciseId === execution.id);
      return {
        exercise: {
          ...planned,
          ...execution,
          exerciseNameSnapshot:
            planned.name ?? planned.exerciseNameSnapshot ?? persisted.exerciseNameSnapshot,
          trackingMetricSnapshot:
            planned.trackingMetric ??
            planned.trackingMetricSnapshot ??
            persisted.trackingMetricSnapshot ??
            'repetitions',
        },
        sets: Array.isArray(execution.sets)
          ? (execution.sets as Row[]).map((set) => ({
              ...(plannedSets.find(
                (plannedSet) => plannedSet.id === set.id || plannedSet.setNumber === set.setNumber,
              ) ?? {}),
              ...set,
            }))
          : [],
      };
    });
  }
  return sessionExercises
    .filter((exercise) => exercise.sessionId === session.id)
    .sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder))
    .map((exercise) => ({
      exercise,
      sets: exerciseSets
        .filter((set) => set.sessionExerciseId === exercise.id)
        .sort((left, right) => Number(left.setNumber) - Number(right.setNumber)),
    }));
}

function daysBetween(from: string, through: string): number {
  if (through < from) return 0;
  return (
    Math.round((Date.parse(`${through}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
  );
}

function adherenceLines(breakdown: AdherenceBreakdown): string[] {
  return [
    `- Aderência: ${breakdown.percentage === null ? NOT_RECORDED : `${breakdown.percentage}%`}`,
    `- Sessões vencidas: ${breakdown.due}`,
    `- Denominador: ${breakdown.denominator}`,
    `- Concluídas: ${breakdown.completed}`,
    `- Parciais: ${breakdown.partial}`,
    `- Perdidas: ${breakdown.missed}`,
    `- Vencidas sem conclusão: ${breakdown.overdue}`,
    `- Canceladas: ${breakdown.cancelled}`,
    `- Futuras (fora do denominador): ${breakdown.future}`,
  ];
}

export function buildEvolutionReport(data: DataExport): string {
  const entities = applyPending(data);
  const profile = current(entities.userProfiles)[0];
  const sessions = current(entities.workoutSessions).sort((left, right) =>
    String(left.plannedLocalDate).localeCompare(String(right.plannedLocalDate)),
  );
  const sessionExercises = current(entities.sessionExercises);
  const exerciseSets = current(entities.exerciseSets);
  const walks = current(entities.walkingDetails);
  const measurements = current(entities.bodyMeasurements).sort((left, right) =>
    String(left.localDate).localeCompare(String(right.localDate)),
  );
  const pains = current(entities.painReports).sort((left, right) =>
    String(left.localDate).localeCompare(String(right.localDate)),
  );
  const coffee = current(entities.coffeeIntakes).sort((left, right) =>
    String(left.localDate).localeCompare(String(right.localDate)),
  );
  const whey = current(entities.wheyIntakes).sort((left, right) =>
    String(left.localDate).localeCompare(String(right.localDate)),
  );
  const photos = current(entities.progressPhotos).sort((left, right) =>
    String(left.localDate).localeCompare(String(right.localDate)),
  );
  const rules = current(entities.scheduleRules);
  const templates = current(entities.workoutTemplates);
  const definitions = current(entities.habitDefinitions);
  const entries = current(entities.habitEntries).sort((left, right) =>
    String(left.localDate).localeCompare(String(right.localDate)),
  );
  const options = new Map<unknown, string>(
    current(entities.habitOptions).map((option) => [option.id, text(option.label)]),
  );
  for (const definition of definitions) {
    if (!Array.isArray(definition.options)) continue;
    for (const option of definition.options as Row[]) options.set(option.id, text(option.label));
  }
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));

  const timeZone = data.timeZone;
  const generatedAt = date(data.exportedAt) ?? NOT_RECORDED;
  const allDates = [
    ...sessions.map((row) => date(row.plannedLocalDate)),
    ...measurements.map((row) => date(row.localDate)),
    ...pains.map((row) => date(row.localDate)),
    ...entries.map((row) => date(row.localDate)),
    ...coffee.map((row) => date(row.localDate)),
    ...whey.map((row) => date(row.localDate)),
    ...photos.map((row) => date(row.localDate)),
  ]
    .filter((item): item is string => item !== null)
    .sort();
  const requestedFrom = data.requestedRange?.from ?? allDates[0] ?? generatedAt;
  const requestedThrough = data.requestedRange?.through ?? allDates.at(-1) ?? generatedAt;

  const adherenceSessions: AdherenceSessionInput[] = sessions.map((session) => ({
    localDate: date(session.plannedLocalDate) ?? requestedFrom,
    plannedLocalTime:
      typeof session.suggestedLocalTime === 'string' ? session.suggestedLocalTime : null,
    status: String(session.status ?? 'planned') as AdherenceSessionInput['status'],
    type: String(session.type ?? 'other') as AdherenceSessionInput['type'],
  }));
  const adherence = calculateAdherence({
    from: requestedFrom,
    now: data.exportedAt,
    sessions: adherenceSessions,
    through: requestedThrough,
    timeZone,
  });
  const evaluatedFrom = adherence.evaluatedFrom;
  const evaluatedThrough = adherence.evaluatedThrough;

  const setHistory: unknown[][] = [];
  const exerciseByDate = new Map<string, Map<string, number>>();
  const stopped = new Map<string, number>();
  for (const session of sessions) {
    const localDate = date(session.plannedLocalDate) ?? NOT_RECORDED;
    for (const group of exerciseRowsForSession(session, sessionExercises, exerciseSets)) {
      const exercise = group.exercise;
      const name = text(exercise.exerciseNameSnapshot ?? exercise.name);
      const metric = exercise.trackingMetricSnapshot ?? exercise.trackingMetric;
      if (exercise.status === 'stopped') stopped.set(name, (stopped.get(name) ?? 0) + 1);
      for (const set of group.sets) {
        setHistory.push([
          localDate,
          session.templateNameSnapshot,
          name,
          exercise.status,
          set.setNumber,
          metricValue(set, metric, true),
          metricValue(set, metric, false),
          set.completed === true ? 'sim' : set.completed === false ? 'não' : NOT_RECORDED,
        ]);
        if (metric === 'repetitions') {
          const repetitions = number(set.actualRepetitions);
          if (repetitions === null) continue;
          const daily = exerciseByDate.get(name) ?? new Map<string, number>();
          daily.set(localDate, (daily.get(localDate) ?? 0) + repetitions);
          exerciseByDate.set(name, daily);
        }
      }
    }
  }

  const habitRows = entries.map((entry) => {
    const definition = definitionById.get(entry.habitDefinitionId);
    return [
      date(entry.localDate) ?? NOT_RECORDED,
      definition?.name,
      habitValue(entry, options),
      definition?.unit,
      entry.notes,
    ];
  });

  const progressionRows = [...exerciseByDate.entries()]
    .filter(([name]) => {
      const normalizedName = normalized(name);
      return normalizedName.includes('flexao') || normalizedName.includes('agachamento');
    })
    .flatMap(([name, daily]) =>
      [...daily.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([localDate, repetitions]) => [localDate, name, repetitions]),
    );

  const muscular = pains.filter((pain) => pain.type === 'muscular');
  const joint = pains.filter((pain) => pain.type === 'joint');
  const otherDiscomfort = pains.filter((pain) => pain.type === 'other');
  const painTable = (rows: Row[]): unknown[][] =>
    rows.map((pain) => [
      date(pain.localDate) ?? NOT_RECORDED,
      pain.bodyRegion === 'other'
        ? text(pain.customBodyRegion)
        : label(BODY_REGION_LABELS, pain.bodyRegion),
      pain.intensityScore ?? NOT_RECORDED,
      label(PAIN_INTENSITY_LABELS, pain.intensity),
      label(PAIN_MOMENT_LABELS, pain.moment),
      boolText(pain.exerciseStopped),
      boolText(pain.swelling),
      boolText(pain.supportDifficulty),
      recoveryDeservesAttention({
        intensityScore: number(pain.intensityScore),
        supportDifficulty: pain.supportDifficulty as boolean | null,
        swelling: pain.swelling as boolean | null,
        type: (pain.type as 'joint' | 'muscular' | 'other') ?? 'other',
      })
        ? 'sim'
        : 'não',
      pain.notes,
    ]);
  const painHeaders = [
    'data',
    'região',
    'intensidade (0-10)',
    'intensidade qualitativa',
    'momento',
    'interrompeu exercício',
    'inchaço',
    'dificuldade para apoiar',
    'merece atenção',
    'observações',
  ];

  // Sessões executáveis (força e caminhada) usadas para separar resposta explícita de ausência.
  const answerable = sessions.filter(
    (session) => session.type === 'strength' || session.type === 'walk',
  );
  const explicitNoPain = answerable.filter((session) => session.recoveryStatus === 'none');
  const reportedPain = answerable.filter((session) => session.recoveryStatus === 'reported');
  const unanswered = answerable.filter(
    (session) => session.recoveryStatus !== 'none' && session.recoveryStatus !== 'reported',
  );

  const exertionRows = sessions
    .filter((session) => number(session.perceivedExertion) !== null)
    .map((session) => [
      date(session.plannedLocalDate) ?? NOT_RECORDED,
      session.templateNameSnapshot,
      number(session.perceivedExertion),
      label(ACTIVITY_LABELS, session.type),
      label(SESSION_STATUS_LABELS, session.status),
    ]);
  const exertionValues = sessions
    .map((session) => number(session.perceivedExertion))
    .filter((item): item is number => item !== null);
  const exertionAverage =
    exertionValues.length === 0
      ? NOT_RECORDED
      : decimal(exertionValues.reduce((total, item) => total + item, 0) / exertionValues.length);

  const coffeeInPeriod = coffee.filter((row) => {
    const localDate = date(row.localDate);
    return localDate !== null && localDate >= evaluatedFrom && localDate <= evaluatedThrough;
  });
  const coffeeCounts = { not_consumed: 0, with_sugar: 0, without_sugar: 0 };
  for (const row of coffeeInPeriod) {
    const status = row.status as CoffeeStatus;
    if (status in coffeeCounts) coffeeCounts[status] += 1;
  }
  const evaluatedDays = daysBetween(evaluatedFrom, evaluatedThrough);
  const coffeeRows = coffee.map((row) => [
    date(row.localDate) ?? NOT_RECORDED,
    coffeeStatusLabel((row.status as CoffeeStatus | undefined) ?? null),
    row.notes,
  ]);

  const wheyRows = whey.map((row) => {
    const tolerance = Array.isArray(row.tolerance) ? (row.tolerance as string[]) : [];
    return [
      date(row.localDate) ?? NOT_RECORDED,
      clock(row.localTime),
      boolText(row.consumed),
      value(row.powderGrams, 'g'),
      value(row.servings),
      value(row.proteinPerServingGrams, 'g'),
      value(row.liquidMl, 'ml'),
      row.mixedWith === 'other' ? text(row.customMixedWith) : label(WHEY_MIX_LABELS, row.mixedWith),
      text(row.brand),
      text(row.product),
      label(WHEY_MOMENT_LABELS, row.moment),
      tolerance.length === 0
        ? NOT_RECORDED
        : tolerance.map((item) => label(WHEY_TOLERANCE_LABELS, item)).join('; '),
      row.notes,
    ];
  });

  const walkBySession = new Map(walks.map((walk) => [walk.sessionId, walk]));
  const walkRows = sessions
    .filter((session) => session.type === 'walk')
    .map((session) => {
      const walk = walkBySession.get(session.id) ?? (session.walking as Row | undefined) ?? {};
      return [
        date(session.plannedLocalDate) ?? NOT_RECORDED,
        clock(session.suggestedLocalTime),
        label(SESSION_STATUS_LABELS, session.status),
        value(walk.plannedDistanceMeters, 'm'),
        value(walk.actualDistanceMeters, 'm'),
        value(walk.durationSeconds, 's'),
        number(session.perceivedExertion) ?? NOT_RECORDED,
        walk.notes ?? session.notes,
      ];
    });

  const templateById = new Map(templates.map((template) => [template.id, template]));
  const routineRows = rules
    .map((rule) => {
      const weekday = number(rule.weekday);
      const template = templateById.get(rule.templateId);
      return [
        weekday === null ? NOT_RECORDED : (WEEKDAY_LABELS[weekday - 1] ?? NOT_RECORDED),
        clock(rule.localTime),
        text(template?.name),
        label(ACTIVITY_LABELS, template?.type),
        `${text(rule.validFrom)} → ${rule.validUntil ? text(rule.validUntil) : 'sem término'}`,
      ];
    })
    .sort((left, right) => String(left[0]).localeCompare(String(right[0]), 'pt-BR'));

  const photoRows = photos.map((photo) => [
    date(photo.localDate) ?? NOT_RECORDED,
    label(PHOTO_POSE_LABELS, photo.pose),
    value(photo.byteSize, 'bytes'),
    text(photo.contentType),
    `${value(photo.widthPx)}×${value(photo.heightPx)}`,
    photo.notes,
  ]);

  const levels = evaluateLevels({
    measurementDates: measurements
      .map((measurement) => date(measurement.localDate))
      .filter((item): item is string => item !== null),
    sessions: sessions.map((session) => ({
      localDate: date(session.plannedLocalDate) ?? requestedFrom,
      status: String(session.status ?? 'planned') as AdherenceSessionInput['status'],
      type: String(session.type ?? 'other') as AdherenceSessionInput['type'],
    })),
  });

  const attentionRows = pains.filter((pain) =>
    recoveryDeservesAttention({
      intensityScore: number(pain.intensityScore),
      supportDifficulty: pain.supportDifficulty as boolean | null,
      swelling: pain.swelling as boolean | null,
      type: (pain.type as 'joint' | 'muscular' | 'other') ?? 'other',
    }),
  );

  const missing: string[] = [];
  if (measurements.length === 0) missing.push('Peso e medidas corporais.');
  else {
    if (measurements.every((row) => number(row.waistCm) === null)) missing.push('Cintura.');
    if (measurements.every((row) => number(row.abdomenCm) === null)) missing.push('Barriga.');
  }
  if (coffee.length === 0) missing.push('Estado do café por dia.');
  if (whey.length === 0) missing.push('Consumo e tolerância ao whey.');
  if (exertionValues.length === 0) missing.push('Esforço percebido nos treinos.');
  if (unanswered.length > 0)
    missing.push(`Resposta de recuperação em ${unanswered.length} sessões executáveis.`);
  if (photos.length === 0) missing.push('Fotos de evolução.');
  if (!profile?.goal) missing.push('Objetivo declarado no perfil.');
  if (rules.length === 0) missing.push('Regras de agenda que descrevem a rotina atual.');

  const summary: string[] = [];
  summary.push(
    adherence.strength.denominator === 0
      ? `Aderência de força: ${NOT_RECORDED}.`
      : `Aderência de força: ${adherence.strength.percentage}% sobre ${adherence.strength.denominator} sessões vencidas (${adherence.strength.completed} concluídas, ${adherence.strength.partial} parciais, ${adherence.strength.missed} perdidas).`,
  );
  summary.push(
    adherence.walk.denominator === 0
      ? `Aderência de caminhada: ${NOT_RECORDED}.`
      : `Aderência de caminhada: ${adherence.walk.percentage}% sobre ${adherence.walk.denominator} caminhadas vencidas.`,
  );
  summary.push(`Evolução do peso: ${trend(measurements, 'weightKg', 'kg')}.`);
  summary.push(`Evolução da cintura: ${trend(measurements, 'waistCm', 'cm')}.`);
  summary.push(`Evolução da barriga: ${trend(measurements, 'abdomenCm', 'cm')}.`);
  summary.push(
    `Esforço percebido médio: ${exertionAverage}${exertionValues.length ? ` em ${exertionValues.length} registros` : ''}.`,
  );
  summary.push(
    `Recuperação: ${explicitNoPain.length} sessões com resposta explícita "sem dor", ${reportedPain.length} com desconforto relatado e ${unanswered.length} sem resposta.`,
  );
  summary.push(
    `Dor muscular: ${muscular.length}; dor articular: ${joint.length}; outros desconfortos: ${otherDiscomfort.length}.`,
  );
  summary.push(
    `Café no período avaliado: ${coffeeCounts.without_sugar} dias sem açúcar, ${coffeeCounts.with_sugar} com açúcar e ${coffeeCounts.not_consumed} sem consumo.`,
  );
  summary.push(`Nível atual: ${levels.current.name}.`);

  const report = [
    '# Relatório de evolução física e rotina de treino',
    '',
    '> Documento gerado automaticamente apenas com dados registrados pelo usuário. Ausências são marcadas como “não registrado”. Dados locais pendentes foram aplicados na ordem em que foram registrados. Este documento não é diagnóstico nem prescrição.',
    '',
    '## Metadados do relatório',
    '',
    `- Data de geração: ${generatedAt}`,
    `- Período solicitado: ${requestedFrom} a ${requestedThrough}`,
    `- Período efetivamente avaliado: ${evaluatedFrom} a ${evaluatedThrough}`,
    `- Dias no período avaliado: ${evaluatedDays}`,
    `- Fuso horário: ${text(timeZone)}`,
    `- Alterações locais pendentes incorporadas: ${data.pendingChanges.length}`,
    '',
    '## Perfil atual',
    '',
    `- Nome: ${text(data.account.name)}`,
    `- Altura: ${value(profile?.heightCm, 'cm')}`,
    `- Objetivo declarado: ${text(profile?.goal)}`,
    `- Horário de treino preferido: ${clock(profile?.preferredWorkoutTime)}`,
    `- Início da conta: ${date(data.account.createdAt) ?? NOT_RECORDED}`,
    `- Sistema de unidades: ${text(profile?.unitSystem)}`,
    '',
    '## Rotina atual',
    '',
    '> Derivada exclusivamente das regras de agenda registradas.',
    '',
    ...table(['dia', 'horário', 'atividade', 'tipo', 'vigência'], routineRows),
    '',
    '## Aderência de força',
    '',
    `> ${ADHERENCE_EXPLANATION}`,
    '',
    ...adherenceLines(adherence.strength),
    '',
    '## Aderência de caminhada',
    '',
    ...adherenceLines(adherence.walk),
    '',
    '## Aderência geral',
    '',
    '> A aderência geral soma força e caminhada com a mesma fórmula; ela não substitui os indicadores separados.',
    '',
    ...adherenceLines(adherence.general),
    '',
    '## Histórico de séries e repetições',
    '',
    ...table(
      ['data', 'sessão', 'exercício', 'estado', 'série', 'planejado', 'realizado', 'concluída'],
      setHistory,
    ),
    '',
    '## Esforço percebido',
    '',
    '> Escala de 0 a 10 registrada no fechamento do treino: 0 nenhum esforço; 1–3 leve; 4–6 moderado; 7–8 difícil; 9 muito difícil; 10 esforço máximo.',
    '',
    `- Média: ${exertionAverage}`,
    `- Sessões com esforço registrado: ${exertionValues.length}`,
    '',
    ...table(['data', 'sessão', 'esforço', 'tipo', 'estado'], exertionRows),
    '',
    '## Caminhadas',
    '',
    '> As caminhadas são apresentadas separadamente e não entram na aderência de força.',
    '',
    ...table(
      [
        'data',
        'horário planejado',
        'estado',
        'distância planejada',
        'distância realizada',
        'duração',
        'esforço percebido',
        'observações',
      ],
      walkRows,
    ),
    '',
    '## Peso e medidas',
    '',
    `- Peso: ${trend(measurements, 'weightKg', 'kg')}`,
    `- Cintura: ${trend(measurements, 'waistCm', 'cm')}`,
    `- Barriga: ${trend(measurements, 'abdomenCm', 'cm')}`,
    '',
    '> Cintura e barriga são medidas distintas e nunca são somadas ou substituídas uma pela outra. Pequenas oscilações não são interpretadas como ganho ou perda real.',
    '',
    ...table(
      ['data', 'horário', 'jejum', 'peso', 'cintura', 'barriga', 'outras medidas', 'observações'],
      measurements.map((measurement) => [
        date(measurement.localDate) ?? NOT_RECORDED,
        clock(
          typeof measurement.measuredAt === 'string'
            ? measurement.measuredAt.slice(11, 16)
            : undefined,
        ),
        boolText(measurement.fasting),
        value(measurement.weightKg, 'kg'),
        value(measurement.waistCm, 'cm'),
        value(measurement.abdomenCm, 'cm'),
        Array.isArray(measurement.additionalMeasurements) &&
        measurement.additionalMeasurements.length
          ? (measurement.additionalMeasurements as Row[])
              .map((item) => `${text(item.label)}: ${value(item.value, text(item.unit))}`)
              .join('; ')
          : NOT_RECORDED,
        measurement.notes,
      ]),
    ),
    '',
    '## Registros explícitos sem dor',
    '',
    '> Somente sessões em que o usuário respondeu explicitamente “não” à pergunta de recuperação. Ausência de registro nunca é tratada como ausência de dor.',
    '',
    `- Treinos com resposta explícita "sem dor": ${explicitNoPain.length}`,
    `- Treinos com desconforto relatado: ${reportedPain.length}`,
    `- Treinos sem resposta registrada: ${unanswered.length}`,
    '',
    ...table(
      ['data', 'sessão', 'tipo', 'estado'],
      explicitNoPain.map((session) => [
        date(session.plannedLocalDate) ?? NOT_RECORDED,
        session.templateNameSnapshot,
        label(ACTIVITY_LABELS, session.type),
        label(SESSION_STATUS_LABELS, session.status),
      ]),
    ),
    '',
    '## Dor muscular',
    '',
    '> Apresentada somente a partir de relatos cujo tipo registrado é `muscular`.',
    '',
    ...table(painHeaders, painTable(muscular)),
    '',
    '## Dor articular',
    '',
    '> Apresentada somente a partir de relatos cujo tipo registrado é `joint`; nunca combinada com dor muscular.',
    '',
    ...table(painHeaders, painTable(joint)),
    '',
    ...(attentionRows.length > 0
      ? [`> ${RECOVERY_ATTENTION_NOTICE}`, '']
      : ['> Nenhum registro sinalizado como merecedor de atenção.', '']),
    '## Outros desconfortos',
    '',
    ...table(painHeaders, painTable(otherDiscomfort)),
    '',
    '## Café',
    '',
    '> Estados registrados: “Não consumi”, “Sem açúcar” e “Com açúcar”. Café sem açúcar nunca é contado como ausência de consumo, e um dia sem linha significa ausência de registro.',
    '',
    `- Dias sem açúcar: ${coffeeCounts.without_sugar}`,
    `- Dias com açúcar: ${coffeeCounts.with_sugar}`,
    `- Dias sem consumo: ${coffeeCounts.not_consumed}`,
    `- Dias sem registro de café no período: ${Math.max(0, evaluatedDays - coffeeInPeriod.length)}`,
    '',
    ...table(['data', 'estado', 'observações'], coffeeRows),
    '',
    '## Whey',
    '',
    '> Registro descritivo de consumo e tolerância. Nenhuma recomendação é derivada destes dados.',
    '',
    ...table(
      [
        'data',
        'horário',
        'consumiu',
        'pó',
        'porções',
        'proteína por porção',
        'líquido',
        'misturado com',
        'marca',
        'produto',
        'momento',
        'tolerância',
        'observações',
      ],
      wheyRows,
    ),
    '',
    '## Alimentação e hábitos',
    '',
    ...table(['data', 'hábito', 'valor', 'unidade', 'observações'], habitRows),
    '',
    '## Progressão',
    '',
    '> Totais somam as repetições realizadas por data para exercícios cujo nome registrado contém “flexão” ou “agachamento”.',
    '',
    ...table(['data', 'exercício', 'repetições realizadas'], progressionRows),
    '',
    '## Níveis',
    '',
    '> Gamificação leve baseada em consistência e registro. Treinar com dor, esforço máximo ou volume excessivo não concede nível.',
    '',
    `- Nível atual: ${levels.current.name}`,
    `- Alcançado em: ${levels.current.achievedAt ?? NOT_RECORDED}`,
    `- Próximo nível: ${levels.next?.name ?? 'nível máximo alcançado'}`,
    `- Progresso até o próximo nível: ${levels.next ? `${levels.progressToNext}%` : '100%'}`,
    '',
    ...table(
      ['nível', 'alcançado em', 'critérios atingidos', 'critérios restantes'],
      levels.levels.map((level) => [
        level.name,
        level.achievedAt ?? NOT_RECORDED,
        level.criteria
          .filter((criterion) => criterion.achieved)
          .map((criterion) => `${criterion.label} ${criterion.value}/${criterion.target}`)
          .join('; ') || NOT_RECORDED,
        level.criteria
          .filter((criterion) => !criterion.achieved)
          .map((criterion) => `${criterion.label} ${criterion.value}/${criterion.target}`)
          .join('; ') || 'nenhum',
      ]),
    ),
    '',
    '## Fotos de evolução',
    '',
    '> Apenas metadados. As imagens permanecem privadas e não possuem endereço público ou assinado.',
    '',
    ...table(['data', 'pose', 'tamanho', 'formato', 'dimensões', 'observações'], photoRows),
    '',
    '## Resumo automático',
    '',
    ...summary.map((item) => `- ${item}`),
    '',
    '## Dados ausentes prioritários',
    '',
    ...(missing.length > 0
      ? missing.map((item) => `- ${item}`)
      : ['- Nenhum dado prioritário está ausente.']),
    '',
    '## Perguntas para revisão externa',
    '',
    '1. A aderência de força e o histórico de séries indicam que o volume atual está adequado, excessivo ou insuficiente?',
    '2. A progressão registrada de flexões e agachamentos justifica alterar séries, repetições ou dificuldade?',
    '3. O esforço percebido médio é coerente com o volume e a frequência registrados?',
    '4. Os registros de dor muscular sugerem necessidade de ajuste de volume ou recuperação?',
    '5. Os registros de dor articular, inchaço ou dificuldade para apoiar exigem avaliação profissional?',
    '6. Caminhadas, peso, cintura e barriga mostram tendências coerentes com o objetivo declarado?',
    '7. O estado do café e o consumo de whey registrados sugerem manter ou discutir ajustes com profissional habilitado?',
    '8. Quais dos dados ausentes prioritários seriam mais úteis em uma próxima avaliação?',
    '',
  ];
  return report.join('\n');
}
