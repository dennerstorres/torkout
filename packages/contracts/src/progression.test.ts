import { describe, expect, it } from 'vitest';
import { progressionDecisionCreateSchema, progressionProposalSchema } from './progression.js';
describe('progression contracts', () => {
  it('accepts explicit decisions and rejects unknown proposal fields', () => {
    expect(progressionDecisionCreateSchema.parse({ decision: 'accepted' }).decision).toBe(
      'accepted',
    );
    expect(() =>
      progressionProposalSchema.parse({
        effectiveAfter: '2026-07-14',
        exerciseId: '00000000-0000-4000-8000-000000000001',
        mode: 'maintain',
        diagnostic: true,
      }),
    ).toThrow();
  });
});
