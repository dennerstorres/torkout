import type { SyncState } from './sync/sync-coordinator';

export function trackingMetricLabel(value: string): string {
  return (
    {
      distance: 'Distância',
      duration: 'Duração',
      repetitions: 'Repetições',
    }[value] ?? 'Outra métrica'
  );
}

export function activityTypeLabel(value: string): string {
  return (
    {
      other: 'Outra atividade',
      rest: 'Descanso',
      strength: 'Força',
      walk: 'Caminhada',
    }[value] ?? 'Outra atividade'
  );
}

export function sessionStatusLabel(value: string): string {
  return (
    {
      cancelled: 'Cancelado',
      completed: 'Concluído',
      in_progress: 'Em andamento',
      missed: 'Perdido',
      partial: 'Parcial',
      planned: 'Planejado',
    }[value] ?? 'Outro estado'
  );
}

export function coffeeStatusLabel(value: string): string {
  return (
    {
      not_consumed: 'Não consumi',
      with_sugar: 'Com açúcar',
      without_sugar: 'Sem açúcar',
    }[value] ?? 'Não registrado'
  );
}

export function wheyMixLabel(value: string): string {
  return (
    {
      other: 'Outro',
      semi_skimmed_milk: 'Leite semidesnatado',
      skimmed_milk: 'Leite desnatado',
      water: 'Água',
      whole_milk: 'Leite integral',
    }[value] ?? 'Não informado'
  );
}

export function proteinFormatLabel(value: string): string {
  return (
    {
      powder: 'Whey em pó',
      ready_to_drink: 'Pronto para beber',
      yogurt: 'Iogurte proteico',
    }[value] ?? 'Whey em pó'
  );
}

/**
 * Dose já escrita por extenso. A medida é uma só por registro — scoop, colher de sopa ou unidade —,
 * então a quantidade nunca aparece somada a uma segunda medida.
 */
export function proteinServingLabel(amount: number, unit: string): string {
  const plural = amount === 1 ? 0 : 1;
  const words = {
    scoop: ['scoop', 'scoops'],
    tablespoon: ['colher (sopa)', 'colheres (sopa)'],
    unit: ['unidade', 'unidades'],
  }[unit];
  if (!words) return formatNumber(amount);
  return `${formatNumber(amount)} ${words[plural]}`;
}

export function wheyMomentLabel(value: string): string {
  return (
    {
      morning: 'Manhã',
      night: 'Noite',
      other: 'Outro',
      post_workout: 'Depois do treino',
      pre_workout: 'Antes do treino',
    }[value] ?? 'Não informado'
  );
}

export function wheyToleranceLabel(value: string): string {
  return (
    {
      bloating: 'Estufamento',
      cramp: 'Cólica',
      diarrhea: 'Diarreia',
      gas: 'Gases',
      nausea: 'Náusea',
      none: 'Sem desconforto',
      other: 'Outro',
    }[value] ?? 'Outro'
  );
}

export function discomfortTypeLabel(value: string): string {
  return (
    {
      joint: 'Dor articular',
      muscular: 'Dor muscular',
      other: 'Outro desconforto',
    }[value] ?? 'Outro desconforto'
  );
}

export function bodyRegionLabel(value: string): string {
  return (
    {
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
      other: 'Outra região',
      shoulder: 'Ombro',
      thigh: 'Coxa',
      wrist: 'Punho',
    }[value] ?? 'Outra região'
  );
}

/** Escala de esforço percebido usada no fechamento do treino. */
export function perceivedExertionLabel(value: number): string {
  if (value <= 0) return 'Nenhum esforço';
  if (value <= 3) return 'Leve';
  if (value <= 6) return 'Moderado';
  if (value <= 8) return 'Difícil';
  if (value === 9) return 'Muito difícil';
  return 'Esforço máximo';
}

export function photoPoseLabel(value: string): string {
  return { back: 'Costas', front: 'Frente', side: 'Lado' }[value] ?? 'Outra pose';
}

export function syncStateMessage(value: SyncState): string {
  return {
    'auth-required':
      'Entre novamente para enviar alterações. Seus dados continuam neste dispositivo.',
    conflict: 'Há uma alteração que precisa da sua decisão.',
    error: 'Não foi possível sincronizar. Nada foi perdido.',
    offline: 'Você está offline. Pode continuar e enviar as alterações depois.',
    pending: 'Alterações salvas neste dispositivo aguardam envio.',
    synced: 'Tudo salvo e sincronizado.',
    syncing: 'Enviando alterações…',
  }[value];
}

export function syncEntityLabel(value: string): string {
  return (
    {
      body_measurement: 'Medição corporal',
      coffee_intake: 'Registro de café',
      habit_definition: 'Hábito',
      habit_entry: 'Registro de hábito',
      pain_report: 'Registro de desconforto',
      whey_intake: 'Registro de proteína',
      workout_session: 'Sessão de treino',
    }[value] ?? 'Registro'
  );
}

export function syncOperationLabel(value: string): string {
  return { create: 'Criação', delete: 'Exclusão', update: 'Atualização' }[value] ?? 'Alteração';
}

export function syncOperationStateLabel(value: string): string {
  return (
    {
      conflict: 'Precisa de decisão',
      failed: 'Falha temporária',
      pending: 'Aguardando envio',
      processing: 'Enviando',
    }[value] ?? 'Em processamento'
  );
}

export function progressionDecisionLabel(value: string): string {
  return { accepted: 'aceita', ignored: 'recusada', snoozed: 'adiada' }[value] ?? 'registrada';
}

export function evidenceLabel(value: string): string {
  return (
    {
      completedSets: 'Séries concluídas',
      painReports: 'Registros de desconforto',
      sessionId: 'Sessão considerada',
      sessionIds: 'Sessões consideradas',
      target: 'Meta avaliada',
    }[value] ?? 'Dado considerado'
  );
}

export function recordFieldLabel(value: string): string {
  return (
    {
      circumferenceCm: 'Cintura',
      jointPainStatus: 'Desconforto articular',
      localDate: 'Data',
      notes: 'Observação',
      plannedLocalDate: 'Data planejada',
      status: 'Estado',
      weightKg: 'Peso',
    }[value] ?? 'Informação'
  );
}

export function recordFieldValue(key: string, value: unknown): string {
  if (key === 'weightKg' && typeof value === 'number') return `${formatNumber(value)} kg`;
  if (key === 'circumferenceCm' && typeof value === 'number') return `${formatNumber(value)} cm`;
  if ((key === 'localDate' || key === 'plannedLocalDate') && typeof value === 'string')
    return formatCivilDate(value);
  if (key === 'status' && typeof value === 'string') return sessionStatusLabel(value);
  if (key === 'jointPainStatus' && typeof value === 'string')
    return (
      {
        none: 'Sem desconforto informado',
        reported: 'Desconforto informado',
        unknown: 'Não informado',
      }[value] ?? 'Não informado'
    );
  if (key.toLowerCase().endsWith('id')) return 'Registro vinculado';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'string') return value;
  return 'Informação preservada';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function formatCivilDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Data preservada';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(`${value}T12:00:00Z`),
  );
}
