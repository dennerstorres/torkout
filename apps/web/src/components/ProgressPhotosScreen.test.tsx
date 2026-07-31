import type { ProgressPhoto } from '@torkout/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProgressPhotosScreen } from './ProgressPhotosScreen';

function photo(overrides: Partial<ProgressPhoto> = {}): ProgressPhoto {
  return {
    byteSize: 120_000,
    capturedAt: null,
    contentType: 'image/jpeg',
    createdAt: '2026-07-10T12:00:00.000Z',
    heightPx: 1600,
    id: 'b3000000-0000-4000-8000-000000000001',
    localDate: '2026-07-10',
    measurement: null,
    notes: null,
    pose: 'front',
    version: 1,
    widthPx: 900,
    ...overrides,
  };
}

function renderScreen(items: ProgressPhoto[] = []) {
  const photoApi = {
    contentUrl: (id: string) => `/api/v1/progress-photos/${id}/content`,
    list: vi.fn(async () => ({ guidance: ['Repita a mesma iluminação.'], items })),
    remove: vi.fn(async () => undefined),
    upload: vi.fn(async () => photo()),
  };
  render(<ProgressPhotosScreen api={photoApi} onBack={vi.fn()} today="2026-07-24" />);
  return photoApi;
}

describe('progress photos', () => {
  it('shows the guidance for repeating the conditions', async () => {
    renderScreen();
    expect(await screen.findByText(/repita a mesma iluminação/i)).toBeVisible();
  });

  it('offers the three poses', async () => {
    renderScreen();
    const pose = await screen.findByLabelText(/pose/i);
    expect(within(pose).getByRole('option', { name: 'Frente' })).toBeInTheDocument();
    expect(within(pose).getByRole('option', { name: 'Lado' })).toBeInTheDocument();
    expect(within(pose).getByRole('option', { name: 'Costas' })).toBeInTheDocument();
  });

  it('states that the photos are private and stay with the account', async () => {
    renderScreen();
    expect(await screen.findByText(/somente você/i)).toBeVisible();
  });

  it('rejects a file that is not a supported image', async () => {
    const photoApi = renderScreen();
    const input = await screen.findByLabelText(/imagem/i);
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'documento.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/formato/i);
    expect(photoApi.upload).not.toHaveBeenCalled();
  });

  it('rejects a file that is too large', async () => {
    const photoApi = renderScreen();
    const input = await screen.findByLabelText(/imagem/i);
    const oversized = new File([new Uint8Array(1024)], 'foto.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversized, 'size', { value: 30 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/tamanho/i);
    expect(photoApi.upload).not.toHaveBeenCalled();
  });

  it('lists the photos in chronological order with their measurements', async () => {
    renderScreen([
      photo({ id: 'b3000000-0000-4000-8000-000000000002', localDate: '2026-07-22' }),
      photo({
        id: 'b3000000-0000-4000-8000-000000000001',
        localDate: '2026-07-10',
        measurement: {
          abdomenCm: 90,
          id: 'b4000000-0000-4000-8000-000000000001',
          waistCm: 84,
          weightKg: 70,
        },
      }),
    ]);
    const timeline = await screen.findByRole('list', { name: /linha do tempo/i });
    const dates = within(timeline)
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(dates[0]).toContain('2026-07-10');
    expect(dates[1]).toContain('2026-07-22');
    expect(timeline).toHaveTextContent('70 kg');
    expect(timeline).toHaveTextContent('84 cm');
  });

  it('never renders a permanent public address for the image', async () => {
    renderScreen([photo()]);
    const image = await screen.findByAltText(/frente em 2026-07-10/i);
    expect(image.getAttribute('src')).toBe(
      '/api/v1/progress-photos/b3000000-0000-4000-8000-000000000001/content',
    );
    expect(image.getAttribute('src')).not.toMatch(/^https?:\/\//);
  });

  it('compares two dates side by side', async () => {
    renderScreen([
      photo({ id: 'b3000000-0000-4000-8000-000000000002', localDate: '2026-07-22' }),
      photo(),
    ]);
    await screen.findByRole('list', { name: /linha do tempo/i });
    fireEvent.change(screen.getByLabelText(/comparar de/i), { target: { value: '2026-07-10' } });
    fireEvent.change(screen.getByLabelText(/comparar até/i), { target: { value: '2026-07-22' } });
    const comparison = screen.getByRole('region', { name: /comparação/i });
    expect(within(comparison).getByAltText(/frente em 2026-07-10/i)).toBeVisible();
    expect(within(comparison).getByAltText(/frente em 2026-07-22/i)).toBeVisible();
  });

  it('requires an explicit confirmation before deleting', async () => {
    const photoApi = renderScreen([photo()]);
    await screen.findByRole('list', { name: /linha do tempo/i });
    fireEvent.click(screen.getByRole('button', { name: /excluir foto de frente em 2026-07-10/i }));
    expect(photoApi.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirmar exclusão/i }));
    await waitFor(() => {
      expect(photoApi.remove).toHaveBeenCalledWith('b3000000-0000-4000-8000-000000000001');
    });
  });
});
