import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  Button,
  EmptyState,
  Field,
  FormGroup,
  MetricCard,
  Panel,
  ProgressBar,
  Section,
  StatusBadge,
  Surface,
} from './ui';

describe('premium UI primitives', () => {
  it('keeps native roles, labels and disabled behavior', () => {
    const onClick = vi.fn();
    render(
      <>
        <Field label="Carga" hint="Em quilogramas" type="number" />
        <Button disabled onClick={onClick}>
          Salvar
        </Button>
      </>,
    );
    expect(screen.getByLabelText('Carga')).toHaveAttribute('type', 'number');
    expect(screen.getByText('Em quilogramas')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('announces progress and renders empty and status states structurally', () => {
    render(
      <>
        <ProgressBar label="Treino" value={45} />
        <EmptyState title="Sem dados">Registre uma sessão.</EmptyState>
        <StatusBadge tone="warning">Pendente</StatusBadge>
      </>,
    );
    expect(screen.getByRole('progressbar', { name: 'Treino' })).toHaveAttribute(
      'aria-valuenow',
      '45',
    );
    expect(screen.getByRole('heading', { name: 'Sem dados' })).toBeVisible();
    expect(screen.getByText('Pendente')).toBeVisible();
  });

  it('keeps metric labels and values structurally separate', () => {
    render(<MetricCard label="Treinos na semana" value="3 de 4" />);

    const metric = screen.getByRole('group', { name: 'Treinos na semana' });
    expect(metric).toHaveClass('metric-card');
    expect(screen.getByText('Treinos na semana')).toHaveClass('metric-card__label');
    expect(screen.getByText('3 de 4')).toHaveClass('metric-card__value');
  });

  it('gives each layout primitive a distinct semantic and density contract', () => {
    render(
      <>
        <Surface density="compact" variant="raised">
          Resumo rápido
        </Surface>
        <Section eyebrow="Rotina" title="Hábitos">
          Conteúdo da seção
        </Section>
        <Panel title="Detalhes do dia">Conteúdo auxiliar</Panel>
        <FormGroup legend="Dias da semana">Controles</FormGroup>
      </>,
    );

    expect(screen.getByText('Resumo rápido')).toHaveClass(
      'surface',
      'surface--compact',
      'surface--raised',
    );
    expect(screen.getByRole('region', { name: 'Hábitos' })).toHaveClass('section');
    expect(screen.getByRole('complementary', { name: 'Detalhes do dia' })).toHaveClass('panel');
    expect(screen.getByRole('group', { name: 'Dias da semana' })).toHaveClass('form-group');
  });
});
