import { expect, test } from '@playwright/test';

test('reviews and explicitly accepts an explainable progression on mobile', async ({ page }) => {
  const userId = 'b7000000-0000-4000-8000-000000000001';
  const suggestionId = 'b7000000-0000-4000-8000-000000000002';
  let accepted = false;
  await page.route('**/auth/get-session', (route) =>
    route.fulfill({
      json: {
        session: { id: 'session-progression', userId },
        user: { id: userId, name: 'Pessoa' },
      },
    }),
  );
  await page.route('**/api/v1/profile', (route) =>
    route.fulfill({ json: { displayName: 'Pessoa', timeZone: 'America/Cuiaba' } }),
  );
  await page.route('**/api/v1/sync/pull**', (route) =>
    route.fulfill({
      json: { changes: [], cursor: null, hasMore: false, serverTime: '2026-07-14T20:00:00Z' },
    }),
  );
  await page.route('**/api/v1/progression/suggestions', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            createdAt: '2026-07-14T20:00:00Z',
            evidence: [{ localDate: '2026-07-12' }, { localDate: '2026-07-14' }],
            explanation: 'Duas sessões consecutivas atingiram a meta sem dor articular.',
            exerciseName: 'Flexão',
            id: suggestionId,
            outcome: 'eligible',
            proposal: { mode: 'increase_repetitions' },
            rule: { code: 'initial-training-progression', version: '1.0.0' },
            safetyNotice: 'Esta sugestão não substitui a orientação de profissional.',
            safetyNoticeVersion: '1.0.0',
            status: 'pending',
            type: 'increase',
            validUntil: null,
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route(`**/api/v1/progression/suggestions/${suggestionId}/decisions`, (route) => {
    accepted = true;
    return route.fulfill({
      json: { decision: 'accepted', effectEntityId: 'effect', id: 'decision' },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Progresso' }).click();
  await page.getByRole('button', { name: 'Ver sugestões de progressão' }).click();
  await expect(page.getByRole('heading', { name: 'Sugestões' })).toBeVisible();
  await expect(page.getByText(/não substitui a orientação/i)).toBeVisible();
  await page.getByText('Como esta sugestão foi calculada').click();
  await expect(page.getByText('Versão 1.0.0', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aceitar' }).click();
  await expect.poll(() => accepted).toBe(true);
  await expect(page.getByRole('status')).toContainText('accepted');
});
