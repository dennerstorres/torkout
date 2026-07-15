import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PwaExperience, type ServiceWorkerUpdate } from './PwaExperience';

describe('PWA installation and lifecycle', () => {
  it('provides platform-specific installation guidance and the installed version', () => {
    render(<PwaExperience version="1.2.3" />);

    expect(screen.getByText('Versão 1.2.3')).toBeVisible();
    fireEvent.click(screen.getByText('Como instalar'));
    expect(screen.getByRole('heading', { name: 'iPhone e iPad' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Android' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Computador' })).toBeVisible();
  });

  it('offers the native install prompt when the browser makes it available', async () => {
    const prompt = vi.fn(async () => undefined);
    const installEvent = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(installEvent, {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    render(<PwaExperience version="1.2.3" />);

    window.dispatchEvent(installEvent);
    fireEvent.click(await screen.findByRole('button', { name: 'Instalar neste dispositivo' }));

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  });

  it('never reloads automatically when an update is waiting', async () => {
    const activate = vi.fn();
    let announceUpdate: ((update: ServiceWorkerUpdate) => void) | undefined;
    const register = vi.fn((onUpdate: (update: ServiceWorkerUpdate) => void) => {
      announceUpdate = onUpdate;
      return () => undefined;
    });
    render(
      <>
        <label>
          Observação em andamento
          <textarea defaultValue="rascunho preservado" />
        </label>
        <PwaExperience registerServiceWorker={register} version="1.2.3" />
      </>,
    );

    announceUpdate?.({ activate });

    expect(await screen.findByRole('status')).toHaveTextContent('Atualização disponível');
    expect(activate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Observação em andamento')).toHaveValue('rascunho preservado');
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar quando estiver pronto' }));
    expect(activate).toHaveBeenCalledOnce();
  });
});
