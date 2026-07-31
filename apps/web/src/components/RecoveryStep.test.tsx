import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RecoveryStep } from './RecoveryStep';

function renderStep(overrides: Partial<Parameters<typeof RecoveryStep>[0]> = {}) {
  const onSubmit = vi.fn();
  const onSkip = vi.fn();
  render(
    <RecoveryStep
      exercises={[
        { id: 'exercise-1', name: 'Flexão' },
        { id: 'exercise-2', name: 'Agachamento' },
      ]}
      localDate="2026-07-24"
      onSkip={onSkip}
      onSubmit={onSubmit}
      sessionName="Treino A"
      {...overrides}
    />,
  );
  return { onSkip, onSubmit };
}

describe('recovery step at the end of a workout', () => {
  it('asks the main question with the four answers', () => {
    renderStep();
    expect(screen.getByText('Sentiu alguma dor ou desconforto?')).toBeVisible();
    for (const name of ['Não', 'Dor muscular', 'Dor articular', 'Outro desconforto']) {
      expect(screen.getByRole('radio', { name })).toBeVisible();
    }
  });

  it('stores an explicit "no pain" answer without asking for details', async () => {
    const { onSubmit } = renderStep();
    fireEvent.click(screen.getByRole('radio', { name: 'Não' }));
    expect(screen.queryByLabelText(/região do corpo/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /concluir treino/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          recovery: { reports: [], status: 'none' },
        }),
      );
    });
  });

  it('asks for the details only when discomfort was reported', async () => {
    const { onSubmit } = renderStep();
    fireEvent.click(screen.getByRole('radio', { name: 'Dor articular' }));
    fireEvent.change(screen.getByLabelText(/região do corpo/i), { target: { value: 'ankle' } });
    fireEvent.change(screen.getByLabelText(/intensidade/i), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/quando ocorreu/i), { target: { value: 'during' } });
    fireEvent.change(screen.getByLabelText(/exercício relacionado/i), {
      target: { value: 'exercise-1' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /interrompi o exercício/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /houve inchaço/i }));
    fireEvent.click(screen.getByRole('button', { name: /concluir treino/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          recovery: {
            reports: [
              expect.objectContaining({
                bodyRegion: 'ankle',
                exerciseId: 'exercise-1',
                exerciseStopped: true,
                intensityScore: 8,
                localDate: '2026-07-24',
                moment: 'during',
                swelling: true,
                type: 'joint',
              }),
            ],
            status: 'reported',
          },
        }),
      );
    });
  });

  it('shows a discreet notice for intense joint pain, swelling or trouble bearing weight', () => {
    renderStep();
    fireEvent.click(screen.getByRole('radio', { name: 'Dor articular' }));
    expect(screen.queryByRole('status', { name: /atenção/i })).toBeNull();
    fireEvent.change(screen.getByLabelText(/intensidade/i), { target: { value: '8' } });
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(/merece atenção/i);
    expect(notice.textContent).not.toMatch(/diagnóstic|receit|medicament/i);
  });

  it('never blocks the workout from being finished', () => {
    renderStep();
    fireEvent.click(screen.getByRole('radio', { name: 'Dor articular' }));
    fireEvent.change(screen.getByLabelText(/intensidade/i), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: /concluir treino/i })).toBeEnabled();
  });

  it('records perceived exertion from zero to ten with a readable scale', async () => {
    const { onSubmit } = renderStep();
    const effort = screen.getByLabelText(/esforço percebido/i);
    expect(effort).toHaveAttribute('min', '0');
    expect(effort).toHaveAttribute('max', '10');
    fireEvent.change(effort, { target: { value: '7' } });
    expect(screen.getByText(/difícil/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /concluir treino/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ perceivedExertion: 7 }));
    });
  });

  it('keeps both the effort and the recovery answer optional', async () => {
    const { onSubmit } = renderStep();
    fireEvent.click(screen.getByRole('button', { name: /concluir treino/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        perceivedExertion: null,
        recovery: { reports: [], status: 'not_answered' },
      });
    });
  });
});
