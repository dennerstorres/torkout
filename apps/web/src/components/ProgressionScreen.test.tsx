import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AppApi, ProgressionSuggestionView } from '../auth-client';
import { ProgressionScreen } from './ProgressionScreen';

const suggestion: ProgressionSuggestionView = {
  createdAt: '2026-07-14T12:00:00.000Z',
  evidence: [{ sessionId: 'session' }],
  explanation: 'Duas sessões atingiram a meta.',
  exerciseName: 'Flexão',
  id: '00000000-0000-4000-8000-000000000010',
  outcome: 'eligible',
  proposal: { mode: 'increase_repetitions' },
  rule: { code: 'initial-training-progression', version: '1.0.0' },
  safetyNotice: 'Não substitui orientação profissional.',
  safetyNoticeVersion: '1.0.0',
  status: 'pending',
  type: 'increase',
  validUntil: null,
  version: 1,
};

describe('ProgressionScreen', () => {
  it('explains a suggestion and saves an explicit decision', async () => {
    const decideProgression = vi
      .fn()
      .mockResolvedValue({ decision: 'accepted', effectEntityId: 'effect', id: 'decision' });
    const api = {
      decideProgression,
      listProgressionSuggestions: vi.fn().mockResolvedValue({ items: [suggestion] }),
    } as unknown as AppApi;
    render(<ProgressionScreen api={api} onBack={() => undefined} />);
    expect(await screen.findByText('Duas sessões atingiram a meta.')).toBeInTheDocument();
    expect(screen.getByText(/Não substitui orientação profissional/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aceitar' }));
    await waitFor(() => expect(decideProgression).toHaveBeenCalledWith(suggestion.id, 'accepted'));
    expect(screen.getByText('Decisão: accepted.')).toBeInTheDocument();
  });
});
