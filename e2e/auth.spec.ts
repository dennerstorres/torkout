import { expect, test } from '@playwright/test';

test('registers and requests password recovery without revealing account existence', async ({
  page,
}) => {
  await page.route('**/auth/get-session', (route) => route.fulfill({ json: null }));
  await page.route('**/auth/sign-up/email', (route) =>
    route.fulfill({
      json: {
        token: null,
        user: { email: 'person@example.invalid', id: 'user-a', name: 'Pessoa' },
      },
    }),
  );
  await page.route('**/auth/request-password-reset', (route) =>
    route.fulfill({ json: { message: 'sent', status: true } }),
  );
  await page.goto('/');

  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.getByLabel('Nome').fill('Pessoa Nova');
  await page.getByLabel('E-mail').fill('person@example.invalid');
  await page.getByLabel('Senha').fill('strong-password-123');
  await page.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page.getByRole('status')).toContainText('enviaremos uma confirmação');

  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await page.getByLabel('E-mail').fill('person@example.invalid');
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('status')).toContainText('Se a conta existir');
});

test('completes onboarding with explicit privacy consent on a mobile viewport', async ({
  page,
}) => {
  await page.route('**/auth/get-session', (route) =>
    route.fulfill({
      json: {
        session: { id: 'session-a', userId: 'user-a' },
        user: { id: 'user-a', name: 'Pessoa A' },
      },
    }),
  );
  await page.route('**/api/v1/profile', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { code: 'PROFILE_NOT_FOUND' }, status: 404 });
    } else {
      await route.fulfill({ json: { displayName: 'Pessoa A' } });
    }
  });
  await page.route('**/api/v1/privacy/documents', (route) =>
    route.fulfill({
      json: {
        documents: [
          {
            content: 'Privacidade',
            title: 'Aviso de privacidade',
            type: 'privacy_notice',
            version: '2026-07-14',
          },
          { content: 'Termos', title: 'Termos de uso', type: 'terms', version: '2026-07-14' },
          {
            content: 'Saúde',
            title: 'Dados de saúde',
            type: 'health_data_consent',
            version: '2026-07-14',
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/privacy/acceptances', (route) => route.fulfill({ status: 204 }));
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Configure seu perfil' })).toBeVisible();
  await page.getByLabel('Nome de exibição').fill('Pessoa A');
  await page.getByLabel('Altura (cm)').fill('171');
  await page.getByLabel('Café').check();
  await page.getByLabel(/Li e aceito os documentos/).check();
  await page.getByLabel(/Entendo que as sugestões/).check();
  await page.getByRole('button', { name: 'Concluir configuração' }).click();
  await expect(page.getByText(/Seu perfil está pronto/)).toBeVisible();
});
