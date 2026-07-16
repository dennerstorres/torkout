import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DesignSystemLab } from './DesignSystemLab';

describe('DesignSystemLab', () => {
  it('documents the supported hierarchy and control states on one page', () => {
    render(<DesignSystemLab />);
    expect(screen.getByRole('heading', { level: 1, name: 'Sistema visual' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ação principal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ação destrutiva' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carregando…' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Sessões concluídas' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Contexto da decisão' })).toBeInTheDocument();
    expect(screen.getByText('Salvo neste dispositivo')).toBeInTheDocument();
    expect(screen.getByText(/Nada foi perdido/)).toBeInTheDocument();
  });
});
