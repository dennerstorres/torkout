export const PROGRESSION_SAFETY_NOTICE =
  'Esta sugestão não substitui a orientação de profissional de saúde ou educação física. Em caso de dor forte ou articular, interrompa o exercício e procure avaliação profissional.';
export const PROGRESSION_SAFETY_NOTICE_VERSION = '1.0.0';

export type PainEvidence = {
  bodyRegion: string;
  exerciseId?: string | null;
  intensity: 'not_informed' | 'light' | 'moderate' | 'strong';
  moment: 'before' | 'during' | 'after' | 'next_day';
  reportId: string;
  type: 'muscular' | 'joint';
};

export type ProgressionSessionEvidence = {
  exerciseId: string;
  exerciseName: string;
  jointPainStatus: 'unknown' | 'none' | 'reported';
  localDate: string;
  pains: PainEvidence[];
  sessionExerciseId: string;
  sessionId: string;
  sourceTemplateExerciseId?: string | null;
  status: 'completed' | 'partial' | 'missed';
  sets: Array<{
    actualRepetitions: number | null;
    plannedRepetitions: number | null;
    setNumber: number;
  }>;
};

export type ProgressionParameters = {
  maximumRepetitions: number;
  minimumRepetitions: number;
  minimumPainFreeSessions: number;
};

export type ProgressionResult = {
  explanation: string;
  outcome: 'eligible' | 'blocked' | 'no_change';
  proposal: {
    effectiveAfter: string;
    exerciseId: string;
    fromRepetitions?: number[];
    mode: 'increase_repetitions' | 'maintain' | 'reduce_repetitions' | 'remove_set' | 'stop';
    sourceTemplateExerciseId?: string | null;
    toRepetitions?: number[];
  };
  suggestionType: 'increase' | 'maintain' | 'reduce' | 'stop';
};

function maximumPain(pains: PainEvidence[], type: PainEvidence['type']) {
  const rank = { not_informed: 0, light: 1, moderate: 2, strong: 3 } as const;
  return pains
    .filter((pain) => pain.type === type)
    .sort((left, right) => rank[right.intensity] - rank[left.intensity])[0];
}

function repetitionTargets(session: ProgressionSessionEvidence): number[] {
  return session.sets
    .map((set) => set.plannedRepetitions)
    .filter((value): value is number => value !== null);
}

function reachedTargets(session: ProgressionSessionEvidence): boolean {
  return (
    session.status === 'completed' &&
    session.sets.length > 0 &&
    session.sets.every(
      (set) =>
        set.plannedRepetitions !== null &&
        set.actualRepetitions !== null &&
        set.actualRepetitions >= set.plannedRepetitions,
    )
  );
}

export function evaluateProgression(
  sessions: ProgressionSessionEvidence[],
  parameters: ProgressionParameters,
): ProgressionResult {
  if (sessions.length === 0) throw new Error('A avaliação exige ao menos uma sessão.');
  const ordered = [...sessions].sort((left, right) =>
    left.localDate.localeCompare(right.localDate),
  );
  const current = ordered.at(-1)!;
  const pains = ordered.flatMap((session) => session.pains);
  const jointPain = maximumPain(pains, 'joint');
  const muscularPain = maximumPain(pains, 'muscular');
  const baseProposal: {
    effectiveAfter: string;
    exerciseId: string;
    sourceTemplateExerciseId?: string | null;
  } = {
    effectiveAfter: current.localDate,
    exerciseId: current.exerciseId,
    ...(current.sourceTemplateExerciseId === undefined
      ? {}
      : { sourceTemplateExerciseId: current.sourceTemplateExerciseId }),
  };

  const squatJointPain = pains.find(
    (pain) =>
      pain.type === 'joint' &&
      pain.moment === 'during' &&
      (pain.bodyRegion === 'foot' || pain.bodyRegion === 'ankle') &&
      current.exerciseName.toLocaleLowerCase('pt-BR').includes('agachamento'),
  );
  if (squatJointPain) {
    return {
      explanation:
        'Foi registrada dor articular no pé ou tornozelo durante o agachamento. Interrompa este exercício, registre o ocorrido e considere buscar avaliação profissional.',
      outcome: 'blocked',
      proposal: { ...baseProposal, mode: 'stop' },
      suggestionType: 'stop',
    };
  }
  if (jointPain || ordered.some((session) => session.jointPainStatus === 'reported')) {
    return {
      explanation:
        'Há registro de dor articular ligado ao exercício. O aumento foi bloqueado e a carga planejada deve ser mantida até uma decisão segura.',
      outcome: 'blocked',
      proposal: { ...baseProposal, mode: 'maintain' },
      suggestionType: 'maintain',
    };
  }
  if (muscularPain?.intensity === 'strong') {
    return {
      explanation:
        'Foi registrada dor muscular forte. Não aumente o volume; priorize recuperação e considere buscar avaliação profissional.',
      outcome: 'blocked',
      proposal: { ...baseProposal, mode: 'stop' },
      suggestionType: 'stop',
    };
  }
  if (muscularPain?.intensity === 'moderate') {
    const targets = repetitionTargets(current);
    const reduced = targets.map((value) =>
      Math.max(parameters.minimumRepetitions, Math.floor(value * 0.9)),
    );
    const repetitionReduction = targets.reduce(
      (total, value, index) => total + (value - reduced[index]!),
      0,
    );
    const removeSetIsSmaller = targets.length > 1 && targets.at(-1)! <= repetitionReduction;
    return {
      explanation: removeSetIsSmaller
        ? 'Foi registrada dor muscular moderada. O aumento foi bloqueado; a menor redução conservadora é remover uma série.'
        : 'Foi registrada dor muscular moderada. O aumento foi bloqueado; a proposta reduz aproximadamente 10% das repetições, sem ultrapassar o limite mínimo.',
      outcome: 'blocked',
      proposal: removeSetIsSmaller
        ? { ...baseProposal, fromRepetitions: targets, mode: 'remove_set' }
        : {
            ...baseProposal,
            fromRepetitions: targets,
            mode: 'reduce_repetitions',
            toRepetitions: reduced,
          },
      suggestionType: 'reduce',
    };
  }
  if (muscularPain?.intensity === 'light') {
    return {
      explanation:
        'Foi registrada dor muscular leve. A sugestão conservadora é manter a meta atual.',
      outcome: 'no_change',
      proposal: { ...baseProposal, mode: 'maintain' },
      suggestionType: 'maintain',
    };
  }
  if (current.status === 'missed') {
    return {
      explanation:
        'A sessão foi perdida. O próximo planejamento é mantido, sem compensação automática.',
      outcome: 'no_change',
      proposal: { ...baseProposal, mode: 'maintain' },
      suggestionType: 'maintain',
    };
  }
  if (ordered.some((session) => session.jointPainStatus === 'unknown')) {
    return {
      explanation:
        'Não há confirmação explícita sobre dor articular em todas as sessões. Os dados são insuficientes para sugerir aumento.',
      outcome: 'no_change',
      proposal: { ...baseProposal, mode: 'maintain' },
      suggestionType: 'maintain',
    };
  }
  const eligible = ordered.filter(reachedTargets).slice(-parameters.minimumPainFreeSessions);
  if (eligible.length < parameters.minimumPainFreeSessions) {
    return {
      explanation: `Ainda são necessárias ${parameters.minimumPainFreeSessions} sessões consecutivas atingindo a meta e com ausência explícita de dor articular.`,
      outcome: 'no_change',
      proposal: { ...baseProposal, mode: 'maintain' },
      suggestionType: 'maintain',
    };
  }
  const targets = repetitionTargets(current);
  const increased = targets.map((value) => Math.min(parameters.maximumRepetitions, value + 1));
  if (targets.every((value, index) => value === increased[index])) {
    return {
      explanation: `A meta já atingiu o limite configurado de ${parameters.maximumRepetitions} repetições por série.`,
      outcome: 'blocked',
      proposal: { ...baseProposal, mode: 'maintain' },
      suggestionType: 'maintain',
    };
  }
  return {
    explanation: `${parameters.minimumPainFreeSessions} sessões consecutivas atingiram a meta com ausência explícita de dor articular. A sugestão é acrescentar 1 repetição por série, respeitando o limite configurado.`,
    outcome: 'eligible',
    proposal: {
      ...baseProposal,
      fromRepetitions: targets,
      mode: 'increase_repetitions',
      toRepetitions: increased,
    },
    suggestionType: 'increase',
  };
}

export function canonicalProgressionEvidence(sessions: ProgressionSessionEvidence[]): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, normalize(item)]),
      );
    return value;
  };
  return JSON.stringify(normalize(sessions));
}
