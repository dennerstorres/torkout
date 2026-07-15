import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import type { ProgressAnalyticsResponse } from '@torkout/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteUserSyncDatabase, UserSyncDatabase } from '../sync/local-database';
import { AnalyticsScreen } from './AnalyticsScreen';

const userId = 'd9000000-0000-4000-8000-000000000001';
const analytics: ProgressAnalyticsResponse = {
  consistency: {
    explanation:
      'Concluída vale 1, parcial vale 0,5 e perdida vale 0; descanso e cancelamento não entram no denominador.',
    formulaVersion: 'weekly-consistency/v1',
    weeks: [
      {
        completedEquivalent: 1.5,
        percentage: 75,
        plannedExecutable: 2,
        weekEnd: '2026-07-12',
        weekStart: '2026-07-06',
      },
    ],
  },
  exercises: [
    {
      exerciseId: '00000000-0000-4000-8000-000000000001',
      metric: 'repetitions',
      name: 'Flexão',
      points: [{ localDate: '2026-07-06', value: 22 }],
      total: 22,
    },
  ],
  measurements: [
    {
      localDate: '2026-07-06',
      measuredAt: '2026-07-06T12:00:00Z',
      waistCm: 91,
      weightKg: 80,
    },
  ],
  pain: [{ bodyRegion: 'knee', count: 1, intensity: 'moderate', type: 'joint' }],
  range: { from: '2026-06-17', through: '2026-07-14' },
  sessions: { completed: 1, partial: 1 },
  walks: { distanceMeters: 2500, frequencyPerWeek: 0.25, sessions: 1 },
};

describe('accessible progress analytics', () => {
  afterEach(async () => {
    cleanup();
    await deleteUserSyncDatabase(userId);
  });

  it('names every chart, exposes tabular alternatives and explains formula and period', async () => {
    const database = new UserSyncDatabase(userId);
    render(
      <AnalyticsScreen
        database={database}
        onBack={vi.fn()}
        onLoad={vi.fn().mockResolvedValue(analytics)}
        today="2026-07-14"
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Progresso' })).toBeVisible();
    const weightChart = await screen.findByRole('group', { name: 'Evolução do peso' });
    expect(
      within(weightChart).getByRole('table', { name: 'Dados de evolução do peso' }),
    ).toBeVisible();
    expect(screen.getByRole('group', { name: 'Evolução da cintura' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Consistência semanal' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Evolução de Flexão' })).toBeVisible();
    expect(screen.getByText('weekly-consistency/v1')).toBeVisible();
    expect(screen.getByText(/17\/06\/2026 a 14\/07\/2026/)).toBeVisible();
    expect(screen.getByText('2,5 km')).toBeVisible();
  });

  it('applies 8-week and custom inclusive filters', async () => {
    const database = new UserSyncDatabase(userId);
    const load = vi.fn().mockImplementation(async (from: string, through: string) => ({
      ...analytics,
      range: { from, through },
    }));
    render(
      <AnalyticsScreen database={database} onBack={vi.fn()} onLoad={load} today="2026-07-14" />,
    );
    await waitFor(() => expect(load).toHaveBeenCalledWith('2026-06-17', '2026-07-14'));
    fireEvent.click(screen.getByRole('button', { name: '8 semanas' }));
    await waitFor(() => expect(load).toHaveBeenCalledWith('2026-05-20', '2026-07-14'));
    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-07-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar período' }));
    await waitFor(() => expect(load).toHaveBeenCalledWith('2026-07-01', '2026-07-10'));
  });

  it('uses the last cached analysis offline and handles empty or insufficient data', async () => {
    const database = new UserSyncDatabase(userId);
    const first = render(
      <AnalyticsScreen
        database={database}
        onBack={vi.fn()}
        onLoad={vi.fn().mockResolvedValue(analytics)}
        today="2026-07-14"
      />,
    );
    expect((await screen.findAllByText('22 repetições')).length).toBeGreaterThan(0);
    await waitFor(async () => expect(await database.analyticsCache.count()).toBe(1));
    first.unmount();

    render(<AnalyticsScreen database={database} onBack={vi.fn()} today="2026-07-14" />);
    expect(await screen.findByText(/análise salva neste dispositivo/i)).toBeVisible();
    expect(screen.getAllByText('22 repetições').length).toBeGreaterThan(0);

    cleanup();
    database.close();
    await deleteUserSyncDatabase(userId);
    const emptyDatabase = new UserSyncDatabase(userId);
    render(
      <AnalyticsScreen
        database={emptyDatabase}
        onBack={vi.fn()}
        onLoad={vi.fn().mockResolvedValue({
          ...analytics,
          consistency: { ...analytics.consistency, weeks: [] },
          exercises: [],
          measurements: [],
          pain: [],
          sessions: { completed: 0, partial: 0 },
          walks: { distanceMeters: 0, frequencyPerWeek: 0, sessions: 0 },
        })}
        today="2026-07-14"
      />,
    );
    expect(await screen.findByText(/Nenhum treino registrado no período/i)).toBeVisible();
    expect(screen.getAllByText(/Dados insuficientes/i).length).toBeGreaterThan(0);
  });
});
