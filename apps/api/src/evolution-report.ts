import type { DataExport, PendingExportChange } from '@torkout/contracts';

type Row = Record<string, unknown>;
type CollectionName = keyof DataExport['entities'];

const NOT_RECORDED = 'não registrado';

const pendingCollections: Partial<Record<PendingExportChange['entityType'], CollectionName>> = {
  body_measurement: 'bodyMeasurements',
  exercise: 'exercises',
  habit_definition: 'habitDefinitions',
  habit_entry: 'habitEntries',
  pain_report: 'painReports',
  training_plan: 'trainingPlans',
  workout_session: 'workoutSessions',
  workout_template: 'workoutTemplates',
};

function text(value: unknown): string {
  return value === null || value === undefined || value === '' ? NOT_RECORDED : String(value);
}

function cell(value: unknown): string {
  return text(value).replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function value(value: unknown, unit?: string): string {
  const parsed = number(value);
  return parsed === null ? NOT_RECORDED : `${parsed}${unit ? ` ${unit}` : ''}`;
}

function date(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? null;
}

function normalized(value: unknown): string {
  return String(value ?? '')
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
  const allDates = [
    ...sessions.map((row) => date(row.plannedLocalDate)),
    ...measurements.map((row) => date(row.localDate)),
    ...pains.map((row) => date(row.localDate)),
    ...entries.map((row) => date(row.localDate)),
  ]
    .filter((item): item is string => item !== null)
    .sort();
  const periodFrom = allDates[0] ?? NOT_RECORDED;
  const periodThrough = allDates.at(-1) ?? NOT_RECORDED;

  const executable = sessions.filter(
    (session) => session.type === 'strength' && session.status !== 'cancelled',
  );
  const completed = executable.filter((session) => session.status === 'completed').length;
  const partial = executable.filter((session) => session.status === 'partial').length;
  const adherence =
    executable.length === 0
      ? NOT_RECORDED
      : `${Math.round(((completed + partial * 0.5) / executable.length) * 10_000) / 100}%`;

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

  const habitRows = (filter: (name: string) => boolean): unknown[][] =>
    entries
      .filter((entry) => filter(normalized(definitionById.get(entry.habitDefinitionId)?.name)))
      .map((entry) => {
        const definition = definitionById.get(entry.habitDefinitionId);
        return [
          date(entry.localDate) ?? NOT_RECORDED,
          definition?.name,
          habitValue(entry, options),
          definition?.unit,
          entry.notes,
        ];
      });
  const isWhey = (name: string) => name.includes('whey');
  const isWheyTolerance = (name: string) => isWhey(name) && name.includes('tolerancia');
  const isEffort = (name: string) =>
    /(^|\b)rpe(\b|$)|esforco percebido|percepcao de esforco/.test(name);
  const wheyConsumptionRows = habitRows((name) => isWhey(name) && !isWheyTolerance(name));
  const wheyToleranceRows = habitRows(isWheyTolerance);
  const effortRows = habitRows(isEffort);
  const generalHabitRows = habitRows((name) => !isWhey(name) && !isEffort(name));

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
  const painTable = (rows: Row[]): unknown[][] =>
    rows.map((pain) => [
      date(pain.localDate) ?? NOT_RECORDED,
      pain.bodyRegion === 'other' ? pain.customBodyRegion : pain.bodyRegion,
      pain.intensity,
      pain.moment,
      pain.exerciseStopped === true ? 'sim' : 'não',
      pain.notes,
    ]);

  const alerts: string[] = [];
  for (const [type, rows] of [
    ['muscular', muscular],
    ['articular', joint],
  ] as const) {
    const counts = new Map<string, number>();
    for (const pain of rows) {
      const region = text(pain.bodyRegion === 'other' ? pain.customBodyRegion : pain.bodyRegion);
      counts.set(region, (counts.get(region) ?? 0) + 1);
    }
    for (const [region, count] of counts) {
      if (count >= 2) alerts.push(`Dor ${type} recorrente em ${region}: ${count} registros.`);
    }
  }
  for (const [name, count] of stopped) {
    if (count >= 2) alerts.push(`Exercício interrompido recorrentemente: ${name}, ${count} vezes.`);
  }
  const missedDates = executable
    .filter((session) => session.status === 'missed')
    .map((session) => date(session.plannedLocalDate))
    .filter((item): item is string => item !== null);
  if (missedDates.length >= 2)
    alerts.push(
      `Treinos de força perdidos em ${missedDates.length} datas: ${missedDates.join(', ')}.`,
    );

  const summary: string[] = [];
  if (executable.length > 0)
    summary.push(
      `${executable.length} treinos de força analisados: ${completed} concluídos, ${partial} parciais e aderência equivalente de ${adherence}.`,
    );
  else summary.push(`Treinos de força: ${NOT_RECORDED}.`);
  const completedWalks = sessions.filter(
    (session) =>
      session.type === 'walk' && (session.status === 'completed' || session.status === 'partial'),
  );
  summary.push(
    completedWalks.length > 0
      ? `${completedWalks.length} caminhadas concluídas ou parciais foram registradas.`
      : `Caminhadas concluídas ou parciais: ${NOT_RECORDED}.`,
  );
  summary.push(`Evolução do peso: ${trend(measurements, 'weightKg', 'kg')}.`);
  summary.push(`Evolução da cintura: ${trend(measurements, 'waistCm', 'cm')}.`);
  summary.push(
    `Dor muscular: ${muscular.length || NOT_RECORDED}; dor articular: ${joint.length || NOT_RECORDED}.`,
  );

  const walkBySession = new Map(walks.map((walk) => [walk.sessionId, walk]));
  const walkRows = sessions
    .filter((session) => session.type === 'walk')
    .map((session) => {
      const walk = walkBySession.get(session.id) ?? (session.walking as Row | undefined) ?? {};
      return [
        date(session.plannedLocalDate) ?? NOT_RECORDED,
        session.status,
        value(walk.plannedDistanceMeters, 'm'),
        value(walk.actualDistanceMeters, 'm'),
        value(walk.durationSeconds, 's'),
        walk.distanceSource,
        walk.notes ?? session.notes,
      ];
    });

  const report = [
    '# Relatório de evolução física e rotina de treino',
    '',
    '> Documento gerado automaticamente apenas com dados registrados pelo usuário. Ausências são marcadas como “não registrado”. Dados locais pendentes foram aplicados na ordem em que foram registrados.',
    '',
    '## Metadados do relatório',
    '',
    `- Data de geração: ${date(data.exportedAt) ?? NOT_RECORDED}`,
    `- Período coberto: ${periodFrom === NOT_RECORDED ? NOT_RECORDED : `${periodFrom} a ${periodThrough}`}`,
    `- Fuso horário: ${text(data.timeZone)}`,
    `- Alterações locais pendentes incorporadas: ${data.pendingChanges.length}`,
    '',
    '## Perfil atual',
    '',
    `- Nome: ${text(data.account.name)}`,
    `- Altura: ${value(profile?.heightCm, 'cm')}`,
    `- Horário de treino preferido: ${text(profile?.preferredWorkoutTime)}`,
    `- Início da conta: ${date(data.account.createdAt) ?? NOT_RECORDED}`,
    `- Sistema de unidades: ${text(profile?.unitSystem)}`,
    '',
    '## Período analisado',
    '',
    periodFrom === NOT_RECORDED
      ? NOT_RECORDED
      : `O relatório cobre registros datados de ${periodFrom} a ${periodThrough}, inclusive.`,
    '',
    '## Aderência aos treinos',
    '',
    `- Aderência equivalente: ${adherence}`,
    `- Fórmula: concluído = 1; parcial = 0,5; demais estados = 0; cancelados não entram no denominador. Apenas sessões de força entram neste indicador.`,
    `- Sessões de força no denominador: ${executable.length || NOT_RECORDED}`,
    `- Concluídas: ${executable.length ? completed : NOT_RECORDED}`,
    `- Parciais: ${executable.length ? partial : NOT_RECORDED}`,
    `- Perdidas: ${executable.length ? executable.filter((session) => session.status === 'missed').length : NOT_RECORDED}`,
    `- Planejadas ou em andamento: ${executable.length ? executable.filter((session) => session.status === 'planned' || session.status === 'in_progress').length : NOT_RECORDED}`,
    '',
    '## Histórico de séries e repetições',
    '',
    ...table(
      ['data', 'sessão', 'exercício', 'estado', 'série', 'planejado', 'realizado', 'concluída'],
      setHistory,
    ),
    '',
    '## Caminhadas',
    '',
    ...table(
      [
        'data',
        'estado',
        'distância planejada',
        'distância realizada',
        'duração',
        'origem',
        'observações',
      ],
      walkRows,
    ),
    '',
    '## Peso e cintura',
    '',
    `- Peso: ${trend(measurements, 'weightKg', 'kg')}`,
    `- Cintura: ${trend(measurements, 'waistCm', 'cm')}`,
    '',
    ...table(
      ['data', 'peso', 'cintura', 'outras medidas', 'observações'],
      measurements.map((measurement) => [
        date(measurement.localDate) ?? NOT_RECORDED,
        value(measurement.weightKg, 'kg'),
        value(measurement.waistCm, 'cm'),
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
    '## Dor muscular',
    '',
    '> Dor muscular é apresentada somente a partir de relatos cujo tipo registrado é `muscular`.',
    '',
    ...table(
      ['data', 'região', 'intensidade', 'momento', 'interrompeu exercício', 'observações'],
      painTable(muscular),
    ),
    '',
    '## Dor articular',
    '',
    '> Dor articular é apresentada somente a partir de relatos cujo tipo registrado é `joint`; ela não é combinada com dor muscular.',
    '',
    ...table(
      ['data', 'região', 'intensidade', 'momento', 'interrompeu exercício', 'observações'],
      painTable(joint),
    ),
    '',
    '## Esforço percebido',
    '',
    '> Fonte: hábitos criados pelo usuário com nome “RPE”, “esforço percebido” ou “percepção de esforço”.',
    '',
    ...table(['data', 'campo', 'valor', 'unidade', 'observações'], effortRows),
    '',
    '## Alimentação e hábitos',
    '',
    ...table(['data', 'hábito', 'valor', 'unidade', 'observações'], generalHabitRows),
    '',
    '## Consumo e tolerância ao whey',
    '',
    '> Fonte: hábitos criados pelo usuário que contêm “whey” no nome. Consumo e tolerância só são diferenciados quando os próprios nomes registrados fazem essa distinção.',
    '',
    '### Consumo',
    '',
    ...table(['data', 'campo', 'valor', 'unidade', 'observações'], wheyConsumptionRows),
    '',
    '### Tolerância',
    '',
    ...table(['data', 'campo', 'valor', 'unidade', 'observações'], wheyToleranceRows),
    '',
    '## Progressão de flexões e agachamentos',
    '',
    '> Totais abaixo somam as repetições realizadas por data para exercícios cujo nome registrado contém “flexão” ou “agachamento”.',
    '',
    ...table(['data', 'exercício', 'repetições realizadas'], progressionRows),
    '',
    '## Resumo automático',
    '',
    ...summary.map((item) => `- ${item}`),
    '',
    '## Alertas de padrões recorrentes',
    '',
    ...(alerts.length
      ? alerts.map((alert) => `- ${alert}`)
      : ['Nenhum padrão recorrente identificado nos dados registrados.']),
    '',
    '## Perguntas para revisão externa',
    '',
    '1. A aderência e o histórico de séries indicam que o volume atual está adequado, excessivo ou insuficiente?',
    '2. A progressão registrada de flexões e agachamentos justifica alterar séries, repetições ou dificuldade?',
    '3. Os registros de dor muscular sugerem necessidade de ajuste de volume ou recuperação?',
    '4. Os registros de dor articular exigem interromper ou substituir algum exercício e buscar avaliação profissional?',
    '5. Caminhadas, peso, cintura, alimentação e hábitos mostram tendências coerentes com o objetivo de treino?',
    '6. Quais dados ainda “não registrados” seriam prioritários para uma próxima avaliação?',
    '7. O consumo e a tolerância ao whey registrados sugerem manter, ajustar ou discutir o uso com profissional habilitado?',
    '',
  ];
  return report.join('\n');
}
