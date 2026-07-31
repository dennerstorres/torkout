import 'fake-indexeddb/auto';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUserSyncDatabase, deleteUserSyncDatabase } from '../sync/local-database';
import { DailyNutrition } from './DailyNutrition';

const userId = 'b1000000-0000-4000-8000-000000000001';

afterEach(async () => {
  await deleteUserSyncDatabase(userId);
});

function renderNutrition(records: never[] = []) {
  const database = createUserSyncDatabase(userId);
  const onSaved = vi.fn();
  render(
    <DailyNutrition
      database={database}
      localDate="2026-07-24"
      now={new Date('2026-07-24T22:00:00.000Z')}
      onSaved={onSaved}
      records={records}
    />,
  );
  return { database, onSaved };
}

describe('daily coffee record', () => {
  it('offers the three explicit states in Portuguese', () => {
    renderNutrition();
    const group = screen.getByRole('radiogroup', { name: /café/i });
    expect(group).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Não consumi' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Sem açúcar' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Com açúcar' })).toBeVisible();
  });

  it('starts with no state selected so absence is never read as "não consumi"', () => {
    renderNutrition();
    for (const name of ['Não consumi', 'Sem açúcar', 'Com açúcar']) {
      expect(screen.getByRole('radio', { name })).not.toBeChecked();
    }
    expect(screen.getByText(/ainda não registrado/i)).toBeVisible();
  });

  it('queues the chosen state locally', async () => {
    const { database } = renderNutrition();
    fireEvent.click(screen.getByRole('radio', { name: 'Sem açúcar' }));

    await waitFor(async () => {
      const queued = await database.outbox.toArray();
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({
        entityType: 'coffee_intake',
        operation: 'create',
        payload: { localDate: '2026-07-24', status: 'without_sugar' },
      });
    });
  });
});

describe('daily whey record', () => {
  it('keeps the form short and saves only what was filled in', async () => {
    const { database } = renderNutrition();
    fireEvent.click(screen.getByRole('button', { name: /registrar whey/i }));
    fireEvent.change(screen.getByLabelText(/quantidade de pó/i), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(/misturado com/i), {
      target: { value: 'skimmed_milk' },
    });
    fireEvent.change(screen.getByLabelText(/momento/i), { target: { value: 'post_workout' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar registro de whey/i }));

    await waitFor(async () => {
      const queued = await database.outbox.toArray();
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({
        entityType: 'whey_intake',
        payload: {
          consumed: true,
          localDate: '2026-07-24',
          mixedWith: 'skimmed_milk',
          moment: 'post_workout',
          powderGrams: 30,
        },
      });
    });
  });

  it('accepts several tolerance occurrences at once', async () => {
    const { database } = renderNutrition();
    fireEvent.click(screen.getByRole('button', { name: /registrar whey/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gases' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Estufamento' }));
    fireEvent.click(screen.getByRole('button', { name: /salvar registro de whey/i }));

    await waitFor(async () => {
      const queued = await database.outbox.toArray();
      expect(queued[0]?.payload).toMatchObject({ tolerance: ['gas', 'bloating'] });
    });
  });

  it('clears the other occurrences when "sem desconforto" is chosen', () => {
    renderNutrition();
    fireEvent.click(screen.getByRole('button', { name: /registrar whey/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gases' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sem desconforto' }));
    expect(screen.getByRole('checkbox', { name: 'Gases' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Sem desconforto' })).toBeChecked();
  });

  it('hides the quantities when the user did not consume whey', () => {
    renderNutrition();
    fireEvent.click(screen.getByRole('button', { name: /registrar whey/i }));
    fireEvent.click(screen.getByRole('radio', { name: 'Não' }));
    expect(screen.queryByLabelText(/quantidade de pó/i)).toBeNull();
  });

  it('asks for the free text only when the liquid is "outro"', () => {
    renderNutrition();
    fireEvent.click(screen.getByRole('button', { name: /registrar whey/i }));
    expect(screen.queryByLabelText(/qual líquido/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/misturado com/i), { target: { value: 'other' } });
    expect(screen.getByLabelText(/qual líquido/i)).toBeVisible();
  });

  it('does not display any medical recommendation', () => {
    renderNutrition();
    fireEvent.click(screen.getByRole('button', { name: /registrar whey/i }));
    expect(document.body.textContent).not.toMatch(
      /recomend|indicad[oa] para|deve tomar|dose ideal/i,
    );
  });
});
