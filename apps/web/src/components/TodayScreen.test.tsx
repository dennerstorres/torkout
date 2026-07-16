import 'fake-indexeddb/auto';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUserSyncDatabase, deleteUserSyncDatabase, entityKey } from '../sync/local-database';
import { TodayScreen } from './TodayScreen';

const userId = 'a7000000-0000-4000-8000-000000000001';
const sessionId = 'a7100000-0000-4000-8000-000000000001';
const exerciseId = 'a7100000-0000-4000-8000-000000000002';
const setId = 'a7100000-0000-4000-8000-000000000003';
const habitId = 'a7200000-0000-4000-8000-000000000001';
const optionId = 'a7200000-0000-4000-8000-000000000002';

async function seed() {
  const database = createUserSyncDatabase(userId);
  await database.records.bulkPut([
    {
      data: {
        exercises: [
          {
            id: exerciseId,
            name: 'Flexão',
            notes: null,
            sets: [
              {
                actualRepetitions: null,
                completed: false,
                id: setId,
                plannedRepetitions: 12,
                setNumber: 1,
              },
            ],
            status: 'planned',
            trackingMetric: 'repetitions',
          },
        ],
        id: sessionId,
        jointPainStatus: 'unknown',
        plannedLocalDate: '2026-07-14',
        status: 'planned',
        templateNameSnapshot: 'Treino A',
        type: 'strength',
        version: 1,
      },
      deletedAt: null,
      entityId: sessionId,
      entityType: 'workout_session' as const,
      key: entityKey('workout_session', sessionId),
      syncStatus: 'synced' as const,
      updatedAt: '2026-07-14T12:00:00.000Z',
      version: 1,
    },
    {
      data: {
        active: true,
        id: habitId,
        name: 'Café',
        options: [{ id: optionId, label: 'Sem açúcar', sortOrder: 0, stableValue: 'no_sugar' }],
        sortOrder: 0,
        type: 'choice',
        version: 1,
      },
      deletedAt: null,
      entityId: habitId,
      entityType: 'habit_definition' as const,
      key: entityKey('habit_definition', habitId),
      syncStatus: 'synced' as const,
      updatedAt: '2026-07-14T12:00:00.000Z',
      version: 1,
    },
  ]);
  return database;
}

describe('Today mobile tracking', () => {
  afterEach(async () => {
    await deleteUserSyncDatabase(userId);
  });

  it('saves every set, pain confirmation, habit and measurement locally', async () => {
    const database = await seed();
    render(
      <TodayScreen
        database={database}
        now={new Date('2026-07-15T01:00:00.000Z')}
        onBack={vi.fn()}
        syncState="offline"
        timeZone="America/Cuiaba"
      />,
    );

    expect(screen.getByText(/14 de julho de 2026/i)).toBeVisible();
    const sessionsRegion = await screen.findByRole('region', { name: 'Sessões de hoje' });
    const summaryRegion = screen.getByRole('region', { name: 'Resumo de hoje' });
    const complementaryRegion = screen.getByRole('region', {
      name: 'Registros complementares',
    });
    expect(complementaryRegion).toContainElement(
      screen.getByRole('heading', { name: 'Hábitos do dia' }),
    );
    expect(complementaryRegion).toHaveTextContent('Dor e desconforto');
    expect(complementaryRegion).toHaveTextContent('Peso e cintura');
    expect(sessionsRegion.compareDocumentPosition(summaryRegion)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar Treino A' }));
    fireEvent.change(await screen.findByLabelText('Série 1 de Flexão'), {
      target: { value: '10' },
    });
    await waitFor(async () => {
      expect((await database.outbox.toArray())[0]?.payload).toMatchObject({
        execution: {
          exercises: [
            expect.objectContaining({
              sets: [expect.objectContaining({ actualRepetitions: 10, id: setId })],
            }),
          ],
          jointPainStatus: 'unknown',
        },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar série em Flexão' }));
    fireEvent.click(screen.getByLabelText('Confirmo que não houve dor articular'));
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar Treino A' }));
    fireEvent.change(await screen.findByLabelText('Café'), { target: { value: optionId } });
    fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: '80.5' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar medida' }).closest('form')!);

    await waitFor(async () => {
      const entries = await database.outbox.toArray();
      expect(entries.map((entry) => entry.entityType)).toEqual(
        expect.arrayContaining(['workout_session', 'habit_entry', 'body_measurement']),
      );
      const session = await database.records.get(entityKey('workout_session', sessionId));
      expect(session?.data).toMatchObject({
        execution: {
          jointPainStatus: 'none',
        },
        status: 'partial',
      });
    });
    expect(screen.getByRole('status')).toHaveTextContent(/salvo localmente|offline/i);
    database.close();
  });

  it('saves a retroactive custom body measurement without requiring weight or waist', async () => {
    const database = await seed();
    render(
      <TodayScreen
        database={database}
        now={new Date('2026-07-15T01:00:00.000Z')}
        onBack={vi.fn()}
        syncState="offline"
        timeZone="America/Cuiaba"
      />,
    );

    fireEvent.change(screen.getByLabelText('Data da medição'), {
      target: { value: '2026-07-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra medida' }));
    fireEvent.change(screen.getByLabelText('Tipo da medida 1'), {
      target: { value: 'abdomen' },
    });
    fireEvent.change(screen.getByLabelText('Valor da medida 1'), { target: { value: '82.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar outra medida' }));
    fireEvent.change(screen.getByLabelText('Tipo da medida 2'), {
      target: { value: 'custom' },
    });
    fireEvent.change(screen.getByLabelText('Nome da medida 2'), {
      target: { value: 'Braço relaxado' },
    });
    fireEvent.change(screen.getByLabelText('Unidade da medida 2'), {
      target: { value: 'mm' },
    });
    fireEvent.change(screen.getByLabelText('Valor da medida 2'), { target: { value: '315' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Salvar medida' }).closest('form')!);

    await waitFor(async () => {
      const measurement = (await database.outbox.toArray()).find(
        (entry) => entry.entityType === 'body_measurement',
      );
      expect(measurement?.payload).toMatchObject({
        additionalMeasurements: [
          { key: 'abdomen', label: 'Abdômen', unit: 'cm', value: 82.5 },
          { key: 'braço_relaxado', label: 'Braço relaxado', unit: 'mm', value: 315 },
        ],
        localDate: '2026-07-01',
        waistCm: null,
        weightKg: null,
      });
    });
    database.close();
  });

  it('restores an unfinished form after a reload from IndexedDB', async () => {
    const database = await seed();
    const first = render(
      <TodayScreen
        database={database}
        now={new Date('2026-07-15T01:00:00.000Z')}
        onBack={vi.fn()}
        syncState="offline"
        timeZone="America/Cuiaba"
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar Treino A' }));
    fireEvent.change(await screen.findByLabelText('Série 1 de Flexão'), {
      target: { value: '11' },
    });
    await waitFor(() => expect(database.outbox.count()).resolves.toBe(1));
    first.unmount();

    render(
      <TodayScreen
        database={database}
        now={new Date('2026-07-15T01:00:00.000Z')}
        onBack={vi.fn()}
        syncState="offline"
        timeZone="America/Cuiaba"
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar Treino A' }));
    expect(await screen.findByLabelText('Série 1 de Flexão')).toHaveValue(11);
    database.close();
  });

  it('presents a rest day as one recovery decision instead of a nested workout', async () => {
    const database = createUserSyncDatabase(userId);
    await database.records.put({
      data: {
        exercises: [],
        id: sessionId,
        jointPainStatus: 'unknown',
        plannedLocalDate: '2026-07-14',
        status: 'planned',
        templateNameSnapshot: 'Descanso',
        type: 'rest',
        version: 1,
      },
      deletedAt: null,
      entityId: sessionId,
      entityType: 'workout_session',
      key: entityKey('workout_session', sessionId),
      syncStatus: 'synced',
      updatedAt: '2026-07-14T12:00:00.000Z',
      version: 1,
    });
    const onPlan = vi.fn();

    render(
      <TodayScreen
        database={database}
        now={new Date('2026-07-15T01:00:00.000Z')}
        onBack={vi.fn()}
        onPlan={onPlan}
        syncState="synced"
        timeZone="America/Cuiaba"
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Dia de recuperação' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Iniciar Descanso' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Planejar outro treino' }));
    expect(onPlan).toHaveBeenCalledOnce();
    database.close();
  });
});
