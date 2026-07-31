import { describe, expect, it } from 'vitest';

import { RECOVERY_ATTENTION_NOTICE, recoveryDeservesAttention } from './recovery.js';

const base = { swelling: false, supportDifficulty: false, type: 'muscular' as const };

describe('recoveryDeservesAttention', () => {
  it('stays quiet for an ordinary muscular soreness', () => {
    expect(recoveryDeservesAttention({ ...base, intensityScore: 4 })).toBe(false);
  });

  it('flags intense joint pain', () => {
    expect(recoveryDeservesAttention({ ...base, intensityScore: 7, type: 'joint' })).toBe(true);
    expect(recoveryDeservesAttention({ ...base, intensityScore: 6, type: 'joint' })).toBe(false);
  });

  it('flags swelling regardless of the reported intensity', () => {
    expect(recoveryDeservesAttention({ ...base, intensityScore: null, swelling: true })).toBe(true);
  });

  it('flags difficulty to walk or bear weight', () => {
    expect(recoveryDeservesAttention({ ...base, supportDifficulty: true })).toBe(true);
  });

  it('does not flag intense muscular soreness alone', () => {
    expect(recoveryDeservesAttention({ ...base, intensityScore: 9 })).toBe(false);
  });

  it('offers a notice that avoids any diagnosis or prescription', () => {
    expect(RECOVERY_ATTENTION_NOTICE).not.toMatch(/diagn|receit|medicament|trate|pare de treinar/i);
    expect(RECOVERY_ATTENTION_NOTICE.length).toBeGreaterThan(20);
  });
});
