import { expect, test } from '@playwright/test';

test('reviews accessible progress analytics and reopens the cached result offline on mobile', async ({
  page,
}) => {
  const userId = 'da000000-0000-4000-8000-000000000001';
  let networkAvailable = true;
  let analyticsRequests = 0;

  await page.route('**/auth/get-session', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: {
        session: { id: 'session-analytics', userId },
        user: { id: userId, name: 'Pessoa AnalÃ­tica' },
      },
    });
  });
  await page.route('**/api/v1/profile', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    return route.fulfill({
      json: { displayName: 'Pessoa AnalÃ­tica', timeZone: 'America/Cuiaba' },
    });
  });
  await page.route('**/api/v1/progress?**', (route) => {
    if (!networkAvailable) return route.abort('internetdisconnected');
    analyticsRequests += 1;
    const url = new URL(route.request().url());
    const from = url.searchParams.get('from')!;
    const through = url.searchParams.get('through')!;
    return route.fulfill({
      json: {
        consistency: {
          explanation:
            'ConcluÃ­da vale 1, parcial vale 0,5 e perdida vale 0; descanso e cancelamento nÃ£o entram.',
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
            name: 'FlexÃ£o',
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
        range: { from, through },
        sessions: { completed: 1, partial: 1 },
        walks: { distanceMeters: 2500, frequencyPerWeek: 0.25, sessions: 1 },
      },
    });
  });
  await page.route('**/api/v1/sync/pull**', (route) =>
    route.fulfill({
      json: {
        changes: [],
        cursor: null,
        hasMore: false,
        serverTime: '2026-07-14T20:00:00Z',
      },
    }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Progresso e indicadores' }).click();
  await expect(page.getByRole('heading', { name: 'Progresso' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'EvoluÃ§Ã£o do peso' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Dados de evoluÃ§Ã£o do peso' })).toBeVisible();
  await expect(page.getByText('weekly-consistency/v1')).toBeVisible();
  await expect(page.getByText('22 repetiÃ§Ãµes').first()).toBeVisible();

  networkAvailable = false;
  await page.reload();
  await expect(page.getByText(/modo offline/i)).toBeVisible();
  await page.getByRole('button', { name: 'Progresso e indicadores' }).click();
  await expect(page.getByRole('status')).toContainText('anÃ¡lise salva neste dispositivo');
  await expect(page.getByText('22 repetiÃ§Ãµes').first()).toBeVisible();
  expect(analyticsRequests).toBe(1);
});
