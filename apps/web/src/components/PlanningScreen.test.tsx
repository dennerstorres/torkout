import 'fake-indexeddb/auto';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUserSyncDatabase, deleteUserSyncDatabase } from '../sync/local-database';
import { PlanningScreen } from './PlanningScreen';

const userId = 'a1000000-0000-4000-8000-000000000001';

async function seedInitialExercises(
  database: ReturnType<typeof createUserSyncDatabase>,
): Promise<void> {
  const base = {
    deletedAt: null,
    entityType: 'exercise' as const,
    syncStatus: 'synced' as const,
    updatedAt: '2026-07-16T12:00:00.000Z',
    version: 1,
  };
  await database.records.bulkPut([
    {
      ...base,
      data: { active: true, category: 'Força', name: 'Flexão', trackingMetric: 'repetitions' },
      entityId: '00000000-0000-4000-8000-000000000001',
      key: 'exercise:00000000-0000-4000-8000-000000000001',
    },
    {
      ...base,
      data: {
        active: true,
        category: 'Força',
        name: 'Agachamento livre',
        trackingMetric: 'repetitions',
      },
      entityId: '00000000-0000-4000-8000-000000000002',
      key: 'exercise:00000000-0000-4000-8000-000000000002',
    },
    {
      ...base,
      data: { active: true, category: 'Cardio', name: 'Caminhada', trackingMetric: 'distance' },
      entityId: '00000000-0000-4000-8000-000000000003',
      key: 'exercise:00000000-0000-4000-8000-000000000003',
    },
  ]);
}

describe('mobile-first planning', () => {
  const openDatabases: ReturnType<typeof createUserSyncDatabase>[] = [];

  function openDatabase() {
    const database = createUserSyncDatabase(userId);
    openDatabases.push(database);
    return database;
  }

  // As telas observam a réplica enquanto montadas. Fechar o banco dentro do teste, com o componente
  // ainda no DOM, interrompe consultas legítimas; o fechamento acontece depois da desmontagem.
  afterEach(async () => {
    openDatabases.splice(0).forEach((database) => database.close());
    await deleteUserSyncDatabase(userId);
  });

  it('creates exercises, a weekly template and an ad-hoc session locally before sync', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="offline" />);

    expect(screen.getByRole('heading', { name: 'Planejamento' })).toBeVisible();
    expect(await screen.findByText('Flexão', { selector: 'strong' })).toBeVisible();
    expect(screen.getByText(/salv.*neste dispositivo/i)).toBeVisible();

    fireEvent.change(screen.getByLabelText('Nome do exercício'), {
      target: { value: 'Prancha' },
    });
    fireEvent.change(screen.getByLabelText('Métrica'), { target: { value: 'duration' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Adicionar exercício' }).closest('form')!);
    expect(await screen.findByText('Prancha', { selector: 'strong' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Catálogo de exercícios' })).toHaveClass(
      'planning-management-list',
    );

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
  });

  it('shows one planning decision area at a time', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="synced" />);

    expect(await screen.findByRole('region', { name: 'Exercícios' })).toBeVisible();
    expect(screen.getByRole('list', { name: 'Catálogo de exercícios' })).toHaveClass(
      'exercise-catalog-list',
    );
    expect(screen.queryByLabelText('Nome do plano')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Plano semanal' }));
    expect(screen.getByLabelText('Nome do plano')).toBeVisible();
    const weeklyForm = screen.getByLabelText('Nome do plano').closest('form');
    expect(weeklyForm?.querySelector('.weekly-plan-basics')).toBeInTheDocument();
    expect(weeklyForm?.querySelector('.weekly-plan-exercises')).toBeInTheDocument();
    expect(weeklyForm?.querySelector('.weekly-plan-schedule')).toBeInTheDocument();
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
  });

  it('creates a multi-exercise recurring workout and materializes its local calendar', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="offline" />);

    await screen.findByText('Flexão', { selector: 'strong' });
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
  });

  it('supports a single-distance walk, Sunday recovery and complete retroactive sessions', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="offline" />);

    await screen.findByText('Flexão', { selector: 'strong' });
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
  });

  it('creates and edits a choice habit locally before synchronization', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="offline" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hábitos' }));
    expect(await screen.findByRole('region', { name: 'Hábitos diários' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nome do hábito'), {
      target: { value: 'Qualidade do sono' },
    });
    fireEvent.change(screen.getByLabelText('Tipo de hábito'), {
      target: { value: 'choice' },
    });
    fireEvent.change(screen.getByLabelText('Opção 1'), { target: { value: 'Ruim' } });
    fireEvent.change(screen.getByLabelText('Opção 2'), { target: { value: 'Boa' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Adicionar hábito' }).closest('form')!);

    expect((await screen.findAllByText('Qualidade do sono')).length).toBeGreaterThan(0);
    await waitFor(async () => {
      const operation = (await database.outbox.toArray()).find(
        (entry) => entry.entityType === 'habit_definition',
      );
      expect(operation).toMatchObject({
        operation: 'create',
        payload: {
          active: true,
          name: 'Qualidade do sono',
          type: 'choice',
        },
      });
      expect((operation?.payload as { options: unknown[] }).options).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar Qualidade do sono' }));
    fireEvent.change(screen.getByLabelText('Nome do hábito'), {
      target: { value: 'Sono' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar alterações' }).closest('form')!);
    expect((await screen.findAllByText('Sono')).length).toBeGreaterThan(0);
    expect(await database.outbox.count()).toBe(1);
    expect((await database.outbox.toArray())[0]).toMatchObject({
      operation: 'create',
      payload: { name: 'Sono' },
    });
  });

  it('reads, deactivates, reactivates and deletes a synchronized habit without deleting history', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    const habitId = 'a8200000-0000-4000-8000-000000000009';
    const removableHabitId = 'a8200000-0000-4000-8000-000000000010';
    const entryId = 'a8300000-0000-4000-8000-000000000009';
    await database.records.bulkPut([
      {
        data: {
          active: true,
          name: 'Hidratação',
          options: [],
          sortOrder: 0,
          type: 'quantity',
          unit: 'copos',
        },
        deletedAt: null,
        entityId: habitId,
        entityType: 'habit_definition',
        key: `habit_definition:${habitId}`,
        syncStatus: 'synced',
        updatedAt: '2026-07-16T12:00:00.000Z',
        version: 2,
      },
      {
        data: {
          active: true,
          name: 'Lembrete',
          options: [],
          sortOrder: 1,
          type: 'boolean',
        },
        deletedAt: null,
        entityId: removableHabitId,
        entityType: 'habit_definition',
        key: `habit_definition:${removableHabitId}`,
        syncStatus: 'synced',
        updatedAt: '2026-07-16T12:00:00.000Z',
        version: 1,
      },
      {
        data: { habitDefinitionId: habitId, localDate: '2026-07-15', numericValue: 8 },
        deletedAt: null,
        entityId: entryId,
        entityType: 'habit_entry',
        key: `habit_entry:${entryId}`,
        syncStatus: 'synced',
        updatedAt: '2026-07-16T12:00:00.000Z',
        version: 1,
      },
    ]);
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="synced" />);

    fireEvent.click(screen.getByRole('button', { name: 'Hábitos' }));
    expect(await screen.findByText('Hidratação')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Desativar Hidratação' }));
    expect(await screen.findByText('Inativo')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Ativar Hidratação' }));
    expect(await screen.findByText('Ativo')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Excluir Hidratação' })).toBeDisabled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Lembrete' }));
    await waitFor(() => expect(screen.queryByText('Lembrete')).not.toBeInTheDocument());
    expect(await database.records.get(`habit_entry:${entryId}`)).toBeDefined();
    const habitOperations = (await database.outbox.toArray()).filter(
      (entry) => entry.entityType === 'habit_definition',
    );
    expect(habitOperations).toHaveLength(2);
    expect(habitOperations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          baseVersion: 1,
          entityId: removableHabitId,
          operation: 'delete',
        }),
      ]),
    );
  });

  it('edits and deletes an exercise received from the initial account seed', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    const exerciseId = '00000000-0000-4000-8000-000000000001';
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="synced" />);

    expect(await screen.findByText('Flexão', { selector: 'strong' })).toBeVisible();
    expect(screen.getAllByText('Flexão', { selector: 'strong' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Flexão' }));
    fireEvent.change(screen.getByLabelText('Nome do exercício'), {
      target: { value: 'Flexão inclinada' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar exercício' }).closest('form')!);
    expect(await screen.findByText('Flexão inclinada', { selector: 'strong' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Desativar Flexão inclinada' }));
    expect(await screen.findByText('Inativo')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Ativar Flexão inclinada' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Flexão inclinada' }));
    await waitFor(() =>
      expect(
        screen.queryByText('Flexão inclinada', { selector: 'strong' }),
      ).not.toBeInTheDocument(),
    );
    expect((await database.outbox.toArray()).at(-1)).toMatchObject({
      entityId: exerciseId,
      entityType: 'exercise',
      operation: 'delete',
    });
  });

  it('edits and deletes a weekly plan without deleting completed sessions', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    const planId = 'a9400000-0000-4000-8000-000000000001';
    const templateId = 'a9500000-0000-4000-8000-000000000001';
    const historicalId = 'a9600000-0000-4000-8000-000000000001';
    const base = {
      deletedAt: null,
      syncStatus: 'synced' as const,
      updatedAt: '2026-07-16T12:00:00.000Z',
      version: 1,
    };
    await database.records.bulkPut([
      {
        ...base,
        data: { name: 'Plano atual', status: 'active', validFrom: '2026-07-01', validUntil: null },
        entityId: planId,
        entityType: 'training_plan',
        key: `training_plan:${planId}`,
      },
      {
        ...base,
        data: {
          exercises: [],
          name: 'Recuperação',
          notes: null,
          planId,
          rules: [
            {
              id: 'a9700000-0000-4000-8000-000000000001',
              localTime: '18:00',
              timeZone: 'America/Cuiaba',
              validFrom: '2026-07-01',
              validUntil: null,
              weekday: 4,
            },
          ],
          type: 'rest',
        },
        entityId: templateId,
        entityType: 'workout_template',
        key: `workout_template:${templateId}`,
      },
      {
        ...base,
        data: {
          exercises: [],
          plannedLocalDate: '2026-07-10',
          source: 'scheduled',
          status: 'completed',
          templateId,
          templateNameSnapshot: 'Recuperação',
          timeZone: 'America/Cuiaba',
          type: 'rest',
        },
        entityId: historicalId,
        entityType: 'workout_session',
        key: `workout_session:${historicalId}`,
      },
    ]);
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="synced" />);
    fireEvent.click(screen.getByRole('button', { name: 'Plano semanal' }));
    expect((await screen.findByText('Plano atual')).closest('ul')).toHaveClass(
      'planning-management-list',
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Plano atual' }));
    expect(screen.getByLabelText('Nome do treino')).toHaveValue('Recuperação');
    fireEvent.change(screen.getByLabelText('Nome do plano'), {
      target: { value: 'Plano renovado' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Salvar alterações do plano' }).closest('form')!,
    );
    expect(await screen.findByText('Plano renovado')).toBeVisible();
    expect(
      (await database.outbox.toArray())
        .filter((item) => item.operation === 'update')
        .map((item) => item.entityType),
    ).toEqual(expect.arrayContaining(['training_plan', 'workout_template']));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Plano renovado' }));
    await waitFor(() => expect(screen.queryByText('Plano renovado')).not.toBeInTheDocument());
    expect(await database.records.get(`workout_session:${historicalId}`)).toBeDefined();
  });

  it('edits and deletes only planned ad-hoc sessions and hides scheduled sessions from the area', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    const plannedId = 'a9200000-0000-4000-8000-000000000001';
    const completedId = 'a9200000-0000-4000-8000-000000000002';
    const scheduledId = 'a9200000-0000-4000-8000-000000000003';
    const session = (id: string, name: string, source: string, status: string) => ({
      data: {
        exercises: [],
        jointPainStatus: 'unknown',
        notes: null,
        plannedLocalDate: '2026-07-20',
        source,
        status,
        suggestedLocalTime: '18:00',
        templateId: source === 'scheduled' ? 'a9300000-0000-4000-8000-000000000001' : null,
        templateNameSnapshot: name,
        timeZone: 'America/Cuiaba',
        type: 'rest',
      },
      deletedAt: null,
      entityId: id,
      entityType: 'workout_session' as const,
      key: `workout_session:${id}`,
      syncStatus: 'synced' as const,
      updatedAt: '2026-07-16T12:00:00.000Z',
      version: 1,
    });
    await database.records.bulkPut([
      session(plannedId, 'Mobilidade', 'ad_hoc', 'planned'),
      session(completedId, 'Alongamento concluído', 'ad_hoc', 'completed'),
      session(scheduledId, 'Treino recorrente', 'scheduled', 'planned'),
    ]);
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="synced" />);
    fireEvent.click(screen.getByRole('button', { name: 'Sessão avulsa' }));

    expect(await screen.findByText('Mobilidade')).toBeVisible();
    expect(screen.getByText('Mobilidade').closest('ul')).toHaveClass('planning-management-list');
    expect(screen.getByText('Alongamento concluído')).toBeVisible();
    expect(screen.queryByText('Treino recorrente')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar Alongamento concluído' }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar Mobilidade' }));
    fireEvent.change(screen.getByLabelText('Nome da sessão avulsa'), {
      target: { value: 'Mobilidade leve' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar sessão avulsa' }).closest('form')!);
    expect(await screen.findByText('Mobilidade leve')).toBeVisible();
    expect((await database.outbox.toArray()).at(-1)?.payload).toMatchObject({
      exercises: [],
      templateNameSnapshot: 'Mobilidade leve',
      type: 'rest',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir Mobilidade leve' }));
    await waitFor(() => expect(screen.queryByText('Mobilidade leve')).not.toBeInTheDocument());
    expect(await database.records.get(`workout_session:${completedId}`)).toBeDefined();
  });

  it('shows an exercise that arrives in the replica while the screen stays open', async () => {
    const database = openDatabase();
    await seedInitialExercises(database);
    render(<PlanningScreen database={database} onBack={vi.fn()} syncState="synced" />);
    expect(await screen.findByText('Flexão', { selector: 'strong' })).toBeVisible();

    // A sincronização escreve na réplica fora desta tela.
    await database.records.put({
      data: {
        active: true,
        category: 'Força',
        name: 'Remada curvada',
        trackingMetric: 'repetitions',
      },
      deletedAt: null,
      entityId: '00000000-0000-4000-8000-000000000009',
      entityType: 'exercise',
      key: 'exercise:00000000-0000-4000-8000-000000000009',
      syncStatus: 'synced',
      updatedAt: '2026-07-16T12:00:00.000Z',
      version: 1,
    });

    expect(await screen.findByText('Remada curvada', { selector: 'strong' })).toBeVisible();
  });
});
