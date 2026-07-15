import 'fake-indexeddb/auto';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUserSyncDatabase, deleteUserSyncDatabase, entityKey } from '../sync/local-database';
import { HistoryScreen } from './HistoryScreen';

const userId = 'a8000000-0000-4000-8000-000000000001';
const strengthId = 'a8100000-0000-4000-8000-000000000001';
const walkId = 'a8100000-0000-4000-8000-000000000002';
const restId = 'a8100000-0000-4000-8000-000000000003';
const habitId = 'a8200000-0000-4000-8000-000000000001';
const entryId = 'a8200000-0000-4000-8000-000000000002';
const measurementId = 'a8300000-0000-4000-8000-000000000001';
const painId = 'a8400000-0000-4000-8000-000000000001';

function record(
  entityType:
    'body_measurement' | 'habit_definition' | 'habit_entry' | 'pain_report' | 'workout_session',
  entityId: string,
  data: Record<string, unknown>,
  syncStatus: 'pending' | 'synced' = 'synced',
) {
  return {
    data: { id: entityId, version: 1, ...data },
    deletedAt: null,
    entityId,
    entityType,
    key: entityKey(entityType, entityId),
    syncStatus,
    updatedAt: '2026-07-14T12:00:00.000Z',
    version: 1,
  } as const;
}

async function seed() {
  const database = createUserSyncDatabase(userId);
  await database.records.bulkPut([
    record(
      'workout_session',
      strengthId,
      {
        notes: 'Original',
        plannedLocalDate: '2026-07-13',
        status: 'partial',
        templateId: 'a8500000-0000-4000-8000-000000000001',
        templateNameSnapshot: 'Força A',
        type: 'strength',
      },
      'pending',
    ),
    record('workout_session', walkId, {
      plannedLocalDate: '2026-07-13',
      status: 'completed',
      templateNameSnapshot: 'Caminhada',
      type: 'walk',
    }),
    record('workout_session', restId, {
      plannedLocalDate: '2026-07-12',
      status: 'planned',
      templateNameSnapshot: 'Descanso',
      type: 'rest',
    }),
    record('habit_definition', habitId, { active: true, name: 'Proteína', type: 'quantity' }),
    record('habit_entry', entryId, {
      habitDefinitionId: habitId,
      localDate: '2026-07-13',
      numericValue: 2,
    }),
    record('body_measurement', measurementId, {
      localDate: '2026-07-13',
      measuredAt: '2026-07-13T12:00:00.000Z',
      weightKg: 80,
    }),
    record('pain_report', painId, {
      bodyRegion: 'knee',
      intensity: 'light',
      localDate: '2026-07-13',
      moment: 'after',
      type: 'joint',
    }),
  ]);
  return database;
}

describe('calendar and historical editing', () => {
  afterEach(async () => deleteUserSyncDatabase(userId));

  it('shows walk and strength badges separately, sync state, and never marks rest as missed', async () => {
    const database = await seed();
    render(
      <HistoryScreen
        database={database}
        initialMonth="2026-07"
        onBack={vi.fn()}
        today="2026-07-14"
      />,
    );

    const day13 = await screen.findByRole('button', { name: /13 de julho/i });
    expect(within(day13).getByText('Força')).toBeVisible();
    expect(within(day13).getByText('Caminhada')).toBeVisible();
    expect(within(day13).getByText('Parcial')).toBeVisible();
    expect(within(day13).getByText('Concluído')).toBeVisible();
    expect(within(day13).getByText('Pendente')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /12 de julho/i }));
    expect(screen.getByRole('heading', { name: 'Descanso' })).toBeVisible();
    const details = screen
      .getByRole('heading', { name: /Detalhes de 12\/07\/2026/i })
      .closest('section')!;
    expect(within(details).getByText(/Estado: Planejado/i)).toBeVisible();
    expect(within(details).queryByText(/Estado: Perdido/i)).not.toBeInTheDocument();
    database.close();
  });

  it('edits historical records through the outbox without changing a template', async () => {
    const database = await seed();
    render(
      <HistoryScreen
        database={database}
        initialMonth="2026-07"
        onBack={vi.fn()}
        today="2026-07-14"
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /13 de julho/i }));
    fireEvent.change(screen.getByLabelText('Observações de Força A'), {
      target: { value: 'Corrigido no histórico' },
    });
    fireEvent.blur(screen.getByLabelText('Observações de Força A'));
    fireEvent.change(screen.getByLabelText('Proteína'), { target: { value: '3' } });
    fireEvent.blur(screen.getByLabelText('Proteína'));
    fireEvent.change(screen.getByLabelText('Peso em 13/07/2026'), { target: { value: '79.5' } });
    fireEvent.blur(screen.getByLabelText('Peso em 13/07/2026'));
    fireEvent.change(screen.getByLabelText('Intensidade da dor em joelho'), {
      target: { value: 'moderate' },
    });

    await waitFor(async () => {
      const operations = await database.outbox.toArray();
      expect(operations.map((item) => item.entityType)).toEqual(
        expect.arrayContaining([
          'workout_session',
          'habit_entry',
          'body_measurement',
          'pain_report',
        ]),
      );
      expect(operations.some((item) => item.entityType === 'workout_template')).toBe(false);
    });
    database.close();
  });

  it('applies combined filters and navigates cached months without network', async () => {
    const database = await seed();
    render(
      <HistoryScreen
        database={database}
        initialMonth="2026-07"
        onBack={vi.fn()}
        today="2026-07-14"
      />,
    );
    fireEvent.change(screen.getByLabelText('Filtrar por atividade'), {
      target: { value: 'strength' },
    });
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'partial' } });
    fireEvent.change(screen.getByLabelText('Filtrar por dor'), { target: { value: 'with' } });
    expect(await screen.findByRole('button', { name: /13 de julho/i })).not.toHaveAttribute(
      'data-filtered-out',
      'true',
    );
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), {
      target: { value: 'completed' },
    });
    expect(screen.getByRole('button', { name: /13 de julho/i })).toHaveAttribute(
      'data-filtered-out',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(screen.getByRole('heading', { name: /junho de 2026/i })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByRole('heading', { name: /julho de 2026/i })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /13 de julho/i })).toBeInTheDocument(),
    );
    database.close();
  });
});
