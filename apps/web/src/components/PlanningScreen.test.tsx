import 'fake-indexeddb/auto';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUserSyncDatabase, deleteUserSyncDatabase } from '../sync/local-database';
import { PlanningScreen } from './PlanningScreen';

const userId = 'a1000000-0000-4000-8000-000000000001';

describe('mobile-first planning', () => {
  afterEach(async () => {
    await deleteUserSyncDatabase(userId);
  });

  it('creates exercises, a weekly template and an ad-hoc session locally before sync', async () => {
    const database = createUserSyncDatabase(userId);
    render(
      <PlanningScreen database={database} onBack={vi.fn()} onSync={vi.fn()} syncState="offline" />,
    );

    expect(screen.getByRole('heading', { name: 'Planejamento' })).toBeVisible();
    expect(screen.getAllByText(/Flexão/).length).toBeGreaterThan(0);
    expect(screen.getByText(/salv.*neste dispositivo/i)).toBeVisible();

    fireEvent.change(screen.getByLabelText('Nome do exercício'), {
      target: { value: 'Prancha' },
    });
    fireEvent.change(screen.getByLabelText('Métrica'), { target: { value: 'duration' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Adicionar exercício' }).closest('form')!);
    expect(await screen.findByText(/Prancha/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Plano semanal' }));
    fireEvent.change(screen.getByLabelText('Nome do plano'), {
      target: { value: 'Plano semanal' },
    });
    fireEvent.change(screen.getByLabelText('Nome do treino'), {
      target: { value: 'Treino A' },
    });
    fireEvent.change(screen.getByLabelText('Exercício do treino'), {
      target: { value: '00000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText('Repetições por série'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByLabelText('Segunda-feira'));
    fireEvent.click(screen.getByLabelText('Sexta-feira'));
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar planejamento' }).closest('form')!);

    await waitFor(async () => {
      const entries = await database.outbox.toArray();
      expect(entries.map((entry) => entry.entityType)).toEqual(
        expect.arrayContaining(['exercise', 'training_plan', 'workout_template']),
      );
    });
    expect((await screen.findAllByText(/Plano semanal/)).length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: 'Sessão avulsa' }));
    fireEvent.change(screen.getByLabelText('Nome da sessão avulsa'), {
      target: { value: 'Caminhada extra' },
    });
    fireEvent.change(screen.getByLabelText('Data da sessão avulsa'), {
      target: { value: '2026-07-18' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Criar sessão avulsa' }).closest('form')!);
    expect((await screen.findAllByText(/Caminhada extra/)).length).toBeGreaterThan(0);
    expect(
      (await database.outbox.toArray()).some((entry) => entry.entityType === 'workout_session'),
    ).toBe(true);

    database.close();
  });

  it('shows one planning decision area at a time', async () => {
    const database = createUserSyncDatabase(userId);
    render(
      <PlanningScreen database={database} onBack={vi.fn()} onSync={vi.fn()} syncState="synced" />,
    );

    expect(await screen.findByRole('region', { name: 'Exercícios' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Catálogo de exercícios' })).toHaveClass(
      'exercise-catalog-list',
    );
    expect(screen.queryByLabelText('Nome do plano')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Plano semanal' }));
    expect(screen.getByLabelText('Nome do plano')).toBeVisible();
    for (const weekday of [
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
      'Domingo',
    ]) {
      expect(screen.getByLabelText(weekday)).toBeVisible();
    }
    expect(screen.queryByLabelText('Nome do exercício')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sessão avulsa' }));
    expect(screen.getByLabelText('Nome da sessão avulsa')).toBeVisible();
    expect(screen.queryByLabelText('Nome do plano')).not.toBeInTheDocument();
    database.close();
  });
});
