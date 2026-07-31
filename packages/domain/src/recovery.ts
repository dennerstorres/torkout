/**
 * Sinaliza registros que merecem atenção do próprio usuário. Não é diagnóstico, não altera treinos
 * e não gera prescrição: apenas destaca o que foi registrado.
 */
export const RECOVERY_ATTENTION_NOTICE =
  'Este registro merece atenção. Acompanhe como você se sente e, se quiser, leve estes dados a um profissional de saúde de sua confiança.';

/** Limite a partir do qual uma dor articular registrada é destacada. */
export const JOINT_PAIN_ATTENTION_SCORE = 7;

export interface RecoveryAttentionInput {
  intensityScore?: number | null | undefined;
  supportDifficulty?: boolean | null | undefined;
  swelling?: boolean | null | undefined;
  type: 'joint' | 'muscular' | 'other';
}

export function recoveryDeservesAttention(report: RecoveryAttentionInput): boolean {
  if (report.swelling === true) return true;
  if (report.supportDifficulty === true) return true;
  return (
    report.type === 'joint' &&
    typeof report.intensityScore === 'number' &&
    report.intensityScore >= JOINT_PAIN_ATTENTION_SCORE
  );
}
