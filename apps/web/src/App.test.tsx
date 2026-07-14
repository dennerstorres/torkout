import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('web smoke test', () => {
  it('identifies the application and its current setup state', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Torkout' })).toBeInTheDocument();
    expect(screen.getByText('Sua evolução começa com um registro de cada vez.')).toBeVisible();
  });
});
