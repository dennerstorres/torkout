import { describe, expect, it } from 'vitest';

import {
  activityTypeLabel,
  recordFieldValue,
  sessionStatusLabel,
  syncStateMessage,
  trackingMetricLabel,
} from './presentation';

describe('presentation dictionary', () => {
  it('translates contract values into consistent pt-BR product language', () => {
    expect(trackingMetricLabel('repetitions')).toBe('Repetições');
    expect(trackingMetricLabel('duration')).toBe('Duração');
    expect(trackingMetricLabel('distance')).toBe('Distância');
    expect(activityTypeLabel('strength')).toBe('Força');
    expect(sessionStatusLabel('in_progress')).toBe('Em andamento');
    expect(syncStateMessage('synced')).toBe('Tudo salvo e sincronizado.');
    expect(recordFieldValue('weightKg', 71.25)).toBe('71,25 kg');
    expect(recordFieldValue('localDate', '2026-07-15')).toBe('15/07/2026');
    expect(recordFieldValue('status', 'in_progress')).toBe('Em andamento');
    expect(recordFieldValue('jointPainStatus', 'unknown')).toBe('Não informado');
  });

  it('uses a safe fallback without exposing unknown internal identifiers', () => {
    expect(trackingMetricLabel('future_metric')).toBe('Outra métrica');
    expect(sessionStatusLabel('future_status')).toBe('Outro estado');
    expect(activityTypeLabel('future_type')).toBe('Outra atividade');
  });
});
