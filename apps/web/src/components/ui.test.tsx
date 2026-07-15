import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button, EmptyState, Field, ProgressBar, StatusBadge } from './ui';

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
});
