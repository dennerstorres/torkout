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
      habit_definition: 'Hábito',
      habit_entry: 'Registro de hábito',
      pain_report: 'Registro de desconforto',
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
