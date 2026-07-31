import type { ProgressPanelResponse } from '@torkout/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressPanel } from './ProgressPanel';

function panel(overrides: Partial<ProgressPanelResponse> = {}): ProgressPanelResponse {
  return {
    abdomen: {
      delta: -1.5,
      first: { localDate: '2026-07-01', value: 90 },
      last: { localDate: '2026-07-22', value: 88.5 },
    },
    adherence: {
      evaluatedFrom: '2026-07-01',
      evaluatedThrough: '2026-07-24',
      explanation: 'Concluída vale 1; parcial vale 0,5.',
      formulaVersion: 'adherence/v1',
      general: {
        cancelled: 0,
        completed: 4,
        denominator: 5,
        due: 5,
        future: 2,
        missed: 1,
        overdue: 0,
        partial: 0,
        percentage: 80,
        score: 4,
      },
      strength: {
        cancelled: 0,
        completed: 2,
        denominator: 3,
        due: 3,
        future: 1,
        missed: 1,
        overdue: 0,
        partial: 0,
        percentage: 66.67,
        score: 2,
      },
      walk: {
        cancelled: 0,
        completed: 2,
        denominator: 2,
        due: 2,
        future: 1,
        missed: 0,
        overdue: 0,
        partial: 0,
        percentage: 100,
        score: 2,
      },
    },
    averagePerceivedExertion: 5.25,
    bestSet: { exercise: 'Agachamento livre', localDate: '2026-07-06', repetitions: 15 },
    concludedSessions: 4,
    currentStreak: 2,
    jointPainReports: 1,
    levels: {
      current: {
        achieved: true,
        achievedAt: '2026-07-06',
        criteria: [
          {
            achieved: true,
            key: 'concludedSessions',
            label: 'Treinos concluídos',
            target: 0,
            value: 4,
          },
        ],
        id: 'beginner-1',
        index: 0,
        name: 'Iniciante I',
      },
      levels: [],
      metrics: {
        concludedSessions: 4,
        currentStreak: 2,
        evolutionRecords: 2,
        longestStreak: 2,
        regularWeeks: 1,
      },
      next: {
        achieved: false,
        achievedAt: null,
        criteria: [
          {
            achieved: false,
            key: 'concludedSessions',
            label: 'Treinos concluídos',
            target: 8,
            value: 4,
          },
          {
            achieved: true,
            key: 'evolutionRecords',
            label: 'Dias com registro de evolução',
            target: 1,
            value: 2,
          },
        ],
        id: 'beginner-2',
        index: 1,
        name: 'Iniciante II',
      },
      progressToNext: 75,
    },
    longestStreak: 2,
    muscularPainReports: 2,
    otherDiscomfortReports: 0,
    perceivedExertionSamples: 4,
    pushUpsPerSession: [{ localDate: '2026-07-06', repetitions: 30 }],
    range: { from: '2026-07-01', through: '2026-07-24' },
    sessionsThisWeek: 2,
    sessionsWithoutPain: 3,
    squatsPerSession: [{ localDate: '2026-07-06', repetitions: 30 }],
    strengthSessionsThisWeek: 0,
    waist: {
      delta: -1.5,
      first: { localDate: '2026-07-01', value: 84 },
      last: { localDate: '2026-07-22', value: 82.5 },
    },
    walkDistanceMeters: 10_200,
    walkDurationSeconds: 6000,
    walksConcluded: 2,
    weight: {
      delta: 1.2,
      first: { localDate: '2026-07-01', value: 70 },
      last: { localDate: '2026-07-22', value: 71.2 },
    },
    ...overrides,
  };
}

describe('progression panel', () => {
  it('shows the consistency indicators', () => {
    render(<ProgressPanel panel={panel()} />);
    const indicators = screen.getByRole('region', { name: /indicadores de progressão/i });
    expect(within(indicators).getByText('Treinos concluídos').closest('div')).toHaveTextContent(
      '4',
    );
    expect(within(indicators).getByText('Sequência atual').closest('div')).toHaveTextContent('2');
    expect(within(indicators).getByText('Melhor sequência').closest('div')).toHaveTextContent('2');
    expect(within(indicators).getByText('Treinos na semana').closest('div')).toHaveTextContent('2');
  });

  it('separates push-ups, squats and the best single set', () => {
    render(<ProgressPanel panel={panel()} />);
    expect(screen.getByRole('table', { name: /flexões por treino/i })).toBeVisible();
    expect(screen.getByRole('table', { name: /agachamentos por treino/i })).toBeVisible();
    expect(screen.getByText(/Agachamento livre/)).toBeVisible();
    expect(screen.getByText(/15 repetições/)).toBeVisible();
  });

  it('reads volume as dated bars with a summary instead of a bare table', () => {
    render(
      <ProgressPanel
        panel={
          panel({
            pushUpsPerSession: [
              { localDate: '2026-07-06', repetitions: 30 },
              { localDate: '2026-07-08', repetitions: 15 },
            ],
          }) as ProgressPanelResponse
        }
      />,
    );
    const table = screen.getByRole('table', { name: /flexões por treino/i });
    expect(within(table).getByText('06/07/2026')).toBeVisible();
    expect(within(table).getByText('08/07/2026')).toBeVisible();
    const fills = table.querySelectorAll<HTMLElement>('.volume-bar__fill');
    expect(fills).toHaveLength(2);
    expect(fills[0]?.style.width).toBe('100%');
    expect(fills[1]?.style.width).toBe('50%');
    expect(table.closest('.volume-card')).toHaveTextContent(/média 22,5/i);
  });

  it('highlights the best single set as a labelled stat', () => {
    render(<ProgressPanel panel={panel()} />);
    const best = screen.getByRole('group', { name: /maior número de repetições em uma série/i });
    expect(within(best).getByText('15 repetições')).toBeVisible();
    expect(best).toHaveTextContent('Agachamento livre');
    expect(best).toHaveTextContent('06/07/2026');
  });

  it('shows body measurement variation as a signed badge', () => {
    render(<ProgressPanel panel={panel()} />);
    const body = screen.getByRole('region', { name: /medidas/i });
    expect(within(body).getByText('+1,2 kg')).toBeVisible();
    expect(within(body).getAllByText('-1,5 cm')).toHaveLength(2);
    expect(within(body).getAllByText('01/07/2026').length).toBeGreaterThan(0);
  });

  it('separates weight, waist and abdomen without calling small changes a real gain', () => {
    render(<ProgressPanel panel={panel()} />);
    const body = screen.getByRole('region', { name: /medidas/i });
    expect(within(body).getByText('Peso')).toBeVisible();
    expect(within(body).getByText('Cintura')).toBeVisible();
    expect(within(body).getByText('Barriga')).toBeVisible();
    expect(body).toHaveTextContent(/oscila/i);
  });

  it('keeps walking apart from strength adherence', () => {
    render(<ProgressPanel panel={panel()} />);
    const walks = screen.getByRole('region', { name: /caminhadas/i });
    expect(walks).toHaveTextContent('2');
    expect(walks).toHaveTextContent('10,2 km');
    expect(screen.getByRole('heading', { name: /aderência de força/i })).toBeVisible();
    expect(screen.getByRole('heading', { name: /aderência de caminhada/i })).toBeVisible();
  });

  it('shows perceived exertion and the recovery counters', () => {
    render(<ProgressPanel panel={panel()} />);
    const recovery = screen.getByRole('region', { name: /esforço e recuperação/i });
    expect(recovery).toHaveTextContent('5,25');
    expect(
      within(recovery)
        .getByText(/sem dor/i)
        .closest('div'),
    ).toHaveTextContent('3');
    expect(
      within(recovery)
        .getByText(/dor muscular/i)
        .closest('div'),
    ).toHaveTextContent('2');
    expect(
      within(recovery)
        .getByText(/dor articular/i)
        .closest('div'),
    ).toHaveTextContent('1');
  });

  it('is not presented as a medical assessment', () => {
    render(<ProgressPanel panel={panel()} />);
    expect(screen.getByText(/não substitu/i)).toBeVisible();
    expect(document.body.textContent).not.toMatch(/diagnóstic|prescriç/i);
  });
});

describe('visual level system', () => {
  it('shows the current level, the progress bar and the date it was reached', () => {
    render(<ProgressPanel panel={panel()} />);
    const levels = screen.getByRole('region', { name: /níveis/i });
    expect(within(levels).getByText('Iniciante I')).toBeVisible();
    expect(levels).toHaveTextContent('06/07/2026');
    expect(within(levels).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  it('lists the criteria already met and the ones still missing', () => {
    render(<ProgressPanel panel={panel()} />);
    const levels = screen.getByRole('region', { name: /níveis/i });
    expect(within(levels).getByRole('list', { name: /critérios atingidos/i })).toHaveTextContent(
      'Dias com registro de evolução',
    );
    expect(within(levels).getByRole('list', { name: /critérios restantes/i })).toHaveTextContent(
      'Treinos concluídos 4/8',
    );
  });

  it('states that pain and maximum effort do not grant levels', () => {
    render(<ProgressPanel panel={panel()} />);
    expect(screen.getByRole('region', { name: /níveis/i })).toHaveTextContent(
      /consistência|não premia/i,
    );
  });
});
