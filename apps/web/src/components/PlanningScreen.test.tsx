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
    fireEvent.change(screen.getByLabelText('Exercício 1'), {
      target: { value: '00000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText('Alvo por série do exercício 1'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByLabelText('Segunda-feira'));
    fireEvent.click(screen.getByLabelText('Sexta-feira'));
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar planejamento' }).closest('form')!);

    await screen.findByText('Planejamento salvo localmente e pendente de sincronização.');

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

  it('creates a multi-exercise recurring workout and materializes its local calendar', async () => {
    const database = createUserSyncDatabase(userId);
    render(
      <PlanningScreen database={database} onBack={vi.fn()} onSync={vi.fn()} syncState="offline" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Plano semanal' }));
    fireEvent.change(screen.getByLabelText('Nome do plano'), { target: { value: 'Recomposição' } });
    fireEvent.change(screen.getByLabelText('Nome do treino'), { target: { value: 'Força A' } });
    fireEvent.change(screen.getByLabelText('Tipo de atividade'), { target: { value: 'strength' } });
    fireEvent.change(screen.getByLabelText('Vigência a partir de'), {
      target: { value: '2026-07-13' },
    });
    fireEvent.change(screen.getByLabelText('Vigência até'), {
      target: { value: '2026-07-31' },
    });
    fireEvent.click(screen.getByLabelText('Terça-feira'));
    fireEvent.click(screen.getByLabelText('Quinta-feira'));
    fireEvent.click(screen.getByLabelText('Sábado'));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar exercício ao treino' }));
    fireEvent.change(screen.getByLabelText('Exercício 2'), {
      target: { value: '00000000-0000-4000-8000-000000000002' },
    });
    fireEvent.change(screen.getByLabelText('Séries do exercício 2'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Alvo por série do exercício 2'), {
      target: { value: '10' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar planejamento' }).closest('form')!);

    await screen.findByText('Planejamento salvo localmente e pendente de sincronização.');
    await waitFor(async () => {
      const template = (await database.outbox.toArray()).find(
        (entry) => entry.entityType === 'workout_template',
      );
      expect(template?.payload).toMatchObject({ type: 'strength' });
      const planned = (template?.payload as { exercises: Array<Record<string, unknown>> })
        .exercises;
      expect(planned).toHaveLength(2);
      expect(planned[0]).toMatchObject({ name: 'Flexão' });
      expect(planned[1]).toMatchObject({ name: 'Agachamento livre' });
      expect((planned[0]!.sets as Array<Record<string, unknown>>)[0]).toMatchObject({
        targetRepetitions: 12,
      });
      expect((planned[1]!.sets as Array<Record<string, unknown>>)[0]).toMatchObject({
        targetRepetitions: 10,
      });
      const localSession = (await database.records.toArray()).find(
        (record) => record.entityType === 'workout_session',
      );
      expect(localSession).toBeDefined();
      const localExercises = localSession?.data.exercises as Array<Record<string, unknown>>;
      expect(localExercises[0]).toMatchObject({
        status: 'planned',
      });
      expect((localExercises[0]?.sets as Array<Record<string, unknown>>)[0]).toMatchObject({
        completed: false,
        plannedRepetitions: 12,
      });
    });
    database.close();
  });

  it('supports a single-distance walk, Sunday recovery and complete retroactive sessions', async () => {
    const database = createUserSyncDatabase(userId);
    render(
      <PlanningScreen database={database} onBack={vi.fn()} onSync={vi.fn()} syncState="offline" />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Plano semanal' }));
    fireEvent.change(screen.getByLabelText('Tipo de atividade'), { target: { value: 'walk' } });
    expect(screen.getByLabelText('Séries do exercício 1')).toHaveValue(1);
    fireEvent.change(screen.getByLabelText('Alvo por série do exercício 1'), {
      target: { value: '5000' },
    });
    fireEvent.click(screen.getByLabelText('Domingo'));

    fireEvent.click(screen.getByRole('button', { name: 'Sessão avulsa' }));
    fireEvent.change(screen.getByLabelText('Nome da sessão avulsa'), {
      target: { value: 'Treino retroativo' },
    });
    fireEvent.change(screen.getByLabelText('Data da sessão avulsa'), {
      target: { value: '2026-07-01' },
    });
    fireEvent.change(screen.getByLabelText('Tipo da sessão avulsa'), {
      target: { value: 'strength' },
    });
    fireEvent.change(screen.getByLabelText('Séries da sessão 1'), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText('Alvo da sessão 1'), {
      target: { value: '15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar exercício à sessão' }));
    fireEvent.change(screen.getByLabelText('Exercício da sessão 2'), {
      target: { value: '00000000-0000-4000-8000-000000000002' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Criar sessão avulsa' }).closest('form')!);

    await waitFor(async () => {
      const session = (await database.outbox.toArray()).find(
        (entry) => entry.entityType === 'workout_session',
      );
      expect(session?.payload).toMatchObject({
        plannedLocalDate: '2026-07-01',
        type: 'strength',
      });
      const exercises = (session?.payload as { exercises: Array<Record<string, unknown>> })
        .exercises;
      expect(exercises).toHaveLength(2);
      expect(exercises[0]?.sets).toHaveLength(4);
      expect((exercises[0]?.sets as Array<Record<string, unknown>>)[0]).toMatchObject({
        targetRepetitions: 15,
      });
      expect(exercises[1]).toMatchObject({ name: 'Agachamento livre' });
    });
    expect((await screen.findAllByText('Treino retroativo')).length).toBeGreaterThan(0);
    database.close();
  });
});
