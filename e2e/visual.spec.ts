import { expect, test, type Page } from '@playwright/test';

const userId = 'd6000000-0000-4000-8000-000000000001';

async function mockToday(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-07-14T20:00:00Z'));
  await page.route('**/auth/get-session', (route) =>
    route.fulfill({
      json: { session: { id: 'visual-session', userId }, user: { id: userId, name: 'Marina' } },
    }),
  );
  await page.route('**/api/v1/profile', (route) =>
    route.fulfill({ json: { displayName: 'Marina', timeZone: 'America/Cuiaba' } }),
  );
  await page.route('**/api/v1/sessions?**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            exercises: [],
            id: 'd6100000-0000-4000-8000-000000000001',
            jointPainStatus: 'unknown',
            plannedLocalDate: '2026-07-14',
            status: 'planned',
            templateNameSnapshot: 'Força e mobilidade',
            type: 'strength',
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/habits', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            active: true,
            id: 'd6200000-0000-4000-8000-000000000001',
            name: 'Hidratação',
            options: [],
            sortOrder: 0,
            type: 'boolean',
            version: 1,
          },
        ],
      },
    }),
  );
  await page.route('**/api/v1/habits/entries?**', (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route('**/api/v1/pain-reports?**', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/v1/measurements?**', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/v1/sync/pull**', (route) =>
    route.fulfill({
      json: { changes: [], cursor: null, hasMore: false, serverTime: '2026-07-14T20:00:00Z' },
    }),
  );
  await page.route('**/api/v1/sync/push', (route) => route.fulfill({ json: { results: [] } }));
  await page.route('**/api/v1/history?**', (route) =>
    route.fulfill({ json: { days: [], habits: [], nextCursor: null } }),
  );
}

function progressPayload(from: string, through: string) {
  return {
    consistency: {
      explanation: 'O indicador compara sessões planejadas e realizadas no período.',
      formulaVersion: 'weekly-consistency/v1',
      weeks: [],
    },
    exercises: [],
    measurements: [],
    pain: [],
    range: { from, through },
    sessions: { completed: 0, partial: 0 },
    walks: { distanceMeters: 0, frequencyPerWeek: 0, sessions: 0 },
  };
}

async function internalRhythmViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const isVisible = (element: HTMLElement) => {
      const closedDisclosure = element.closest('details:not([open])');
      if (closedDisclosure && element !== closedDisclosure.querySelector(':scope > summary')) {
        return false;
      }
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
      );
    };
    const violations: string[] = [];
    const labels = [...document.querySelectorAll<HTMLElement>('main label')].filter((label) =>
      isVisible(label),
    );

    for (const label of labels) {
      const control = label.querySelector<HTMLElement>('input, select, textarea');
      if (!control) continue;
      const gap = Number.parseFloat(getComputedStyle(label).gap || '0');
      if (gap < 8) {
        violations.push(`label-controle: ${label.innerText.trim().slice(0, 48)} (${gap}px)`);
      }
    }

    const parents = new Set(labels.map((label) => label.parentElement).filter(Boolean));
    for (const parent of parents) {
      const siblings = [...parent!.children].filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element.matches('label') && isVisible(element),
      );
      for (let index = 1; index < siblings.length; index += 1) {
        const previous = siblings[index - 1]!;
        const current = siblings[index]!;
        if (
          previous.classList.contains('inline-check') ||
          current.classList.contains('inline-check')
        ) {
          continue;
        }
        const previousBox = previous.getBoundingClientRect();
        const currentBox = current.getBoundingClientRect();
        const horizontalOverlap =
          Math.min(previousBox.right, currentBox.right) -
          Math.max(previousBox.left, currentBox.left);
        if (horizontalOverlap <= 0 || currentBox.top < previousBox.bottom - 1) continue;
        const gap = currentBox.top - previousBox.bottom;
        if (gap < 16) {
          violations.push(
            `campo-campo: ${previous.innerText.trim().slice(0, 24)} → ${current.innerText.trim().slice(0, 24)} (${Math.round(gap)}px)`,
          );
        }
      }
    }

    for (const heading of document.querySelectorAll<HTMLElement>('main h2')) {
      if (!isVisible(heading)) continue;
      const next = heading.nextElementSibling;
      if (!(next instanceof HTMLElement) || !isVisible(next)) continue;
      const headingBox = heading.getBoundingClientRect();
      const nextBox = next.getBoundingClientRect();
      const horizontalOverlap =
        Math.min(headingBox.right, nextBox.right) - Math.max(headingBox.left, nextBox.left);
      if (horizontalOverlap <= 0 || nextBox.top < headingBox.bottom - 1) continue;
      const gap = nextBox.top - headingBox.bottom;
      if (gap < 16) {
        violations.push(`título-conteúdo: ${heading.innerText.trim()} (${Math.round(gap)}px)`);
      }
    }

    return violations;
  });
}

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  // Phase 14 snapshots are retained as rejected historical evidence, not an acceptance gate.
  // Re-enable these only after new Phase 15 baselines receive the documented human approval.
  test.skip(`legacy rejected Today baseline — ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockToday(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot(`today-${viewport.name}.png`, { animations: 'disabled' });
  });
}

test('phase 15 preserves internal field and heading rhythm across authenticated pages', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await mockToday(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  expect(await internalRhythmViolations(page)).toEqual([]);

  await page.getByRole('button', { name: 'Planejamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Planejamento', exact: true })).toBeVisible();
  expect(await internalRhythmViolations(page)).toEqual([]);
  for (const area of ['Plano semanal', 'Sessão avulsa']) {
    await page.getByRole('button', { name: area, exact: true }).click();
    expect(await internalRhythmViolations(page)).toEqual([]);
  }

  for (const destination of ['Histórico', 'Progresso', 'Conta']) {
    await page.getByRole('button', { name: destination, exact: true }).click();
    await expect(page.getByRole('heading', { name: destination, exact: true })).toBeVisible();
    expect(await internalRhythmViolations(page)).toEqual([]);
  }
});

for (const width of [320, 360, 390, 430]) {
  test(`phase 15 layout invariants — ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 844, width });
    await mockToday(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();

    const initialGeometry = await page.evaluate(() => ({
      headerHeight: document.querySelector('.app-header')?.getBoundingClientRect().height ?? 0,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      sessionsTop: document.querySelector('.sessions-section')?.getBoundingClientRect().top ?? 0,
      summaryTop: document.querySelector('.today-summary')?.getBoundingClientRect().top ?? 0,
    }));
    expect(initialGeometry.scrollWidth).toBeLessThanOrEqual(initialGeometry.innerWidth);
    expect(initialGeometry.headerHeight).toBeLessThanOrEqual(64);
    expect(initialGeometry.sessionsTop).toBeLessThan(initialGeometry.summaryTop);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bottomGeometry = await page.evaluate(() => {
      const navigation = document.querySelector('.primary-navigation');
      const candidates = [
        ...document.querySelectorAll<HTMLElement>(
          '.page-outlet main button, .page-outlet main input, .page-outlet main select, .page-outlet main textarea, .page-outlet main summary',
        ),
      ].filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const closedDisclosure = element.closest('details:not([open])');
        const isClosedDisclosureSummary =
          closedDisclosure && element === closedDisclosure.querySelector(':scope > summary');
        return (
          (!closedDisclosure || isClosedDisclosureSummary) &&
          box.width > 0 &&
          box.height > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      });
      return {
        lastControl: candidates.at(-1)?.getBoundingClientRect().toJSON() ?? null,
        navigation: navigation?.getBoundingClientRect().toJSON() ?? null,
      };
    });
    expect(bottomGeometry.lastControl).not.toBeNull();
    expect(bottomGeometry.navigation).not.toBeNull();
    expect(bottomGeometry.lastControl!.bottom).toBeLessThanOrEqual(
      bottomGeometry.navigation!.top - 8,
    );
  });
}

for (const viewport of [
  { height: 1024, name: 'tablet-portrait', width: 768 },
  { height: 768, name: 'tablet-landscape', width: 1024 },
  { height: 768, name: 'desktop-1366', width: 1366 },
  { height: 900, name: 'desktop-1440', width: 1440 },
  { height: 1080, name: 'desktop-1920', width: 1920 },
]) {
  test(`phase 15 broad viewport invariants — ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockToday(page);
    await page.goto('/');
    for (const destination of ['Hoje', 'Planejamento', 'Histórico', 'Progresso', 'Conta']) {
      await page.getByRole('button', { name: destination, exact: true }).click();
      const heading = page.getByRole('heading', { name: destination, exact: true });
      await expect(heading).toBeVisible();
      await expect(page.getByRole('button', { name: destination, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      const width = await page.evaluate(() => {
        const outlet = document.querySelector('.page-outlet')?.getBoundingClientRect();
        const main = document.querySelector('.page-outlet > main')?.getBoundingClientRect();
        return {
          document: document.documentElement.scrollWidth,
          mainLeft: main?.left ?? 0,
          mainRight: main?.right ?? 0,
          outletLeft: outlet?.left ?? 0,
          outletRight: outlet?.right ?? 0,
          viewport: innerWidth,
        };
      });
      expect(width.document).toBeLessThanOrEqual(width.viewport);
      expect(Math.abs(width.mainLeft - width.outletLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs(width.mainRight - width.outletRight)).toBeLessThanOrEqual(1);
      if (destination === 'Hoje' && viewport.width >= 1024) {
        const complementary = await page.evaluate(() =>
          [...document.querySelectorAll('.today-complementary-grid > *')].map((element) => {
            const box = element.getBoundingClientRect();
            return { bottom: box.bottom, left: box.left, top: box.top, width: box.width };
          }),
        );
        // A partir da fase 24 os 5 cards complementares (café, whey, hábitos, dores, medidas) são
        // distribuídos em 3 colunas por fluxo, e não em linhas: cartões de alturas diferentes
        // deixavam vãos verticais quando a linha herdava a altura do cartão de hábitos. O invariante
        // é a coluna: mesma largura, largura mínima utilizável e nenhum vão maior que o gap.
        expect(complementary).toHaveLength(5);
        const columns = new Map<number, typeof complementary>();
        for (const item of complementary) {
          const left = Math.round(item.left);
          columns.set(left, [...(columns.get(left) ?? []), item]);
        }
        expect(columns.size).toBe(3);
        expect(new Set(complementary.map((item) => Math.round(item.width))).size).toBe(1);
        expect(complementary.every((item) => item.width >= 224)).toBe(true);
        for (const column of columns.values()) {
          const ordered = [...column].sort((first, second) => first.top - second.top);
          for (let index = 1; index < ordered.length; index += 1) {
            expect(
              Math.round(ordered[index]!.top - ordered[index - 1]!.bottom),
            ).toBeLessThanOrEqual(24);
          }
        }
      }
      if (destination === 'Planejamento') {
        const gap = await page.evaluate(() => {
          const heading = document.querySelector('#exercise-heading')!;
          const list = document.querySelector('.exercise-catalog-list')!;
          return list.getBoundingClientRect().top - heading.getBoundingClientRect().bottom;
        });
        expect(gap).toBeGreaterThanOrEqual(16);
      }
      if (destination === 'Conta') {
        const gap = await page.evaluate(() => {
          const group = document.querySelector('.account-export-actions')!;
          const option = group.children[0]!.getBoundingClientRect();
          const actions = group.children[1]!.getBoundingClientRect();
          return actions.top - option.bottom;
        });
        expect(gap).toBeGreaterThanOrEqual(16);
      }
    }
  });
}

test('phase 15 route transition resets scroll, focus and active destination together', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await mockToday(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  const heading = page.getByRole('heading', { name: 'Histórico', exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole('button', { name: 'Histórico', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('phase 15 remains operable with 200% text zoom', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 320 });
  await mockToday(page);
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  const geometry = await page.evaluate(() => ({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
  await expect(page.getByRole('button', { name: 'Planejamento', exact: true })).toBeVisible();
});

async function controlsBelowIosZoomThreshold(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const zoomingControls = [
      ...document.querySelectorAll<HTMLElement>('input, select, textarea'),
    ].filter((control) => {
      if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type)) {
        return false;
      }
      const box = control.getBoundingClientRect();
      const style = getComputedStyle(control);
      return box.width > 0 && style.visibility !== 'hidden';
    });
    return zoomingControls
      .map((control) => ({
        control,
        size: Number.parseFloat(getComputedStyle(control).fontSize || '0'),
      }))
      .filter(({ size }) => size < 16)
      .map(
        ({ control, size }) =>
          `${control.tagName.toLowerCase()}[${control.getAttribute('type') ?? 'text'}] ${
            control.getAttribute('aria-label') ?? control.id ?? ''
          } (${size}px)`,
      );
  });
}

test('phase 21 keeps focusing a field from zooming the page on iOS', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await mockToday(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();

  const viewport = await page.evaluate(
    () => document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
  );
  expect(viewport).not.toContain('user-scalable=no');
  expect(viewport).not.toContain('maximum-scale');

  for (const disclosure of await page.getByRole('group').all()) {
    if (await disclosure.evaluate((element) => element.tagName === 'DETAILS')) {
      await disclosure.evaluate((element) => element.setAttribute('open', ''));
    }
  }
  expect(await controlsBelowIosZoomThreshold(page)).toEqual([]);

  for (const destination of ['Planejamento', 'Histórico', 'Progresso', 'Conta']) {
    await page.getByRole('button', { name: destination, exact: true }).click();
    await expect(page.getByRole('heading', { name: destination, exact: true })).toBeVisible();
    expect(await controlsBelowIosZoomThreshold(page)).toEqual([]);
  }
});

test('phase 15 history loading reserves the final calendar geometry', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await mockToday(page);
  await page.unroute('**/api/v1/history?**');
  let releaseHistory!: () => void;
  const historyGate = new Promise<void>((resolve) => {
    releaseHistory = resolve;
  });
  await page.route('**/api/v1/history?**', async (route) => {
    await historyGate;
    await route.fulfill({ json: { days: [], habits: [], nextCursor: null } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Histórico', exact: true }).click();
  await expect(page.getByText('Carregando histórico…')).toBeAttached();
  const before = await page.evaluate(() => ({
    calendarHeight: document.querySelector('.history-calendar')?.getBoundingClientRect().height,
    detailTop: document.querySelector('.history-detail')?.getBoundingClientRect().top,
  }));

  releaseHistory();
  await expect(page.getByRole('button', { name: /15 de julho de 2026/i })).toBeVisible();
  const after = await page.evaluate(() => ({
    calendarHeight: document.querySelector('.history-calendar')?.getBoundingClientRect().height,
    detailTop: document.querySelector('.history-detail')?.getBoundingClientRect().top,
    scrollY,
  }));
  const calendarShift = Math.abs((after.calendarHeight ?? 0) - (before.calendarHeight ?? 0));
  const detailShift = Math.abs((after.detailTop ?? 0) - (before.detailTop ?? 0));
  expect(calendarShift).toBeLessThanOrEqual(8);
  expect(detailShift).toBeLessThanOrEqual(8);
  expect(detailShift / 844).toBeLessThanOrEqual(0.01);
  expect(after.scrollY).toBe(0);
});

test('phase 15 progress loading keeps heading, toolbar and first result anchored', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await mockToday(page);
  let releaseProgress!: () => void;
  const progressGate = new Promise<void>((resolve) => {
    releaseProgress = resolve;
  });
  await page.route('**/api/v1/progress?**', async (route) => {
    const url = new URL(route.request().url());
    await progressGate;
    await route.fulfill({
      json: progressPayload(url.searchParams.get('from')!, url.searchParams.get('through')!),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Progresso', exact: true }).click();
  await expect(page.getByTestId('analytics-loading-grid')).toBeVisible();
  const before = await page.evaluate(() => ({
    gridTop: document.querySelector('.analytics-grid')?.getBoundingClientRect().top,
    headingTop: document.querySelector('.analytics-header h1')?.getBoundingClientRect().top,
    toolbarTop: document.querySelector('.analytics-filters')?.getBoundingClientRect().top,
  }));

  releaseProgress();
  await expect(page.getByRole('heading', { name: 'Resumo do período' })).toBeVisible();
  const after = await page.evaluate(() => ({
    gridTop: document.querySelector('.analytics-grid')?.getBoundingClientRect().top,
    headingTop: document.querySelector('.analytics-header h1')?.getBoundingClientRect().top,
    scrollY,
    toolbarTop: document.querySelector('.analytics-filters')?.getBoundingClientRect().top,
  }));
  expect(Math.abs((after.headingTop ?? 0) - (before.headingTop ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((after.toolbarTop ?? 0) - (before.toolbarTop ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((after.gridTop ?? 0) - (before.gridTop ?? 0))).toBeLessThanOrEqual(2);
  expect(after.scrollY).toBe(0);
});

test('phase 24 keeps Today inside the viewport with several choice habits on desktop', async ({
  page,
}) => {
  await page.setViewportSize({ height: 1080, width: 1920 });
  await mockToday(page);
  // A conta real tem vários hábitos de escolha; o catálogo mockado tinha um único hábito booleano.
  await page.route('**/api/v1/habits', (route) =>
    route.fulfill({
      json: {
        items: ['Café', 'Proteína', 'Arroz', 'Salada'].map((name, index) => ({
          active: true,
          id: `d620000${index}-0000-4000-8000-00000000000${index + 1}`,
          name,
          options: [
            { id: `d630000${index}-0000-4000-8000-000000000001`, label: 'Sim', sortOrder: 0 },
            { id: `d630000${index}-0000-4000-8000-000000000002`, label: 'Não', sortOrder: 1 },
          ],
          sortOrder: index,
          type: 'choice',
          version: 1,
        })),
      },
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hábitos do dia' })).toBeVisible();

  const geometry = await page.evaluate(() => {
    const outlet = document.querySelector('.page-outlet')!.getBoundingClientRect();
    const overflowing = [...document.querySelectorAll<HTMLElement>('main *')]
      .filter((element) => element.getBoundingClientRect().right > outlet.right + 1)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
    return {
      innerWidth,
      overflowing: overflowing.slice(0, 5),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(geometry.overflowing).toEqual([]);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);

  // Cartões de alturas diferentes não podem abrir vão vertical maior que o próprio gap: o cartão de
  // hábitos é o mais alto e não pode empurrar café, whey, dor e medidas para longe do cartão seguinte.
  const columnGaps = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.today-complementary-grid > *')].map(
      (element) => element.getBoundingClientRect(),
    );
    const columns = new Map<number, DOMRect[]>();
    for (const card of cards) {
      const left = Math.round(card.left);
      columns.set(left, [...(columns.get(left) ?? []), card]);
    }
    const gaps: number[] = [];
    for (const column of columns.values()) {
      const ordered = [...column].sort((first, second) => first.top - second.top);
      for (let index = 1; index < ordered.length; index += 1) {
        gaps.push(Math.round(ordered[index]!.top - ordered[index - 1]!.bottom));
      }
    }
    return gaps;
  });
  expect(Math.max(0, ...columnGaps)).toBeLessThanOrEqual(24);
});

function progressPanelPayload() {
  const trend = (first: number, last: number) => ({
    delta: Number((last - first).toFixed(2)),
    first: { localDate: '2026-07-01', value: first },
    last: { localDate: '2026-07-13', value: last },
  });
  const breakdown = (percentage: number | null) => ({
    cancelled: 0,
    completed: 7,
    denominator: 8,
    due: 8,
    future: 1,
    missed: 1,
    overdue: 0,
    partial: 0,
    percentage,
    score: 7,
  });
  return {
    abdomen: trend(90, 88.5),
    adherence: {
      evaluatedFrom: '2026-07-01',
      evaluatedThrough: '2026-07-14',
      explanation: 'Concluída vale 1; parcial vale 0,5.',
      formulaVersion: 'adherence/v1',
      general: breakdown(87.5),
      strength: breakdown(87.5),
      walk: breakdown(null),
    },
    averagePerceivedExertion: 5.25,
    bestSet: { exercise: 'Agachamento livre', localDate: '2026-07-13', repetitions: 15 },
    concludedSessions: 7,
    currentStreak: 2,
    jointPainReports: 1,
    levels: {
      current: {
        achieved: true,
        achievedAt: '2026-07-06',
        criteria: [],
        id: 'beginner-1',
        index: 0,
        name: 'Iniciante I',
      },
      levels: [],
      metrics: {
        concludedSessions: 7,
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
            value: 7,
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
    pushUpsPerSession: [
      { localDate: '2026-07-06', repetitions: 30 },
      { localDate: '2026-07-13', repetitions: 36 },
    ],
    range: { from: '2026-07-01', through: '2026-07-14' },
    sessionsThisWeek: 2,
    sessionsWithoutPain: 3,
    squatsPerSession: [
      { localDate: '2026-07-06', repetitions: 30 },
      { localDate: '2026-07-13', repetitions: 45 },
    ],
    strengthSessionsThisWeek: 2,
    waist: trend(84, 82.5),
    walkDistanceMeters: 10_200,
    walkDurationSeconds: 6000,
    walksConcluded: 2,
    weight: trend(70, 71.2),
  };
}

test('phase 25 keeps the progress panel readable instead of colliding labels and values', async ({
  page,
}) => {
  await page.setViewportSize({ height: 1080, width: 1440 });
  await mockToday(page);
  await page.route('**/api/v1/progress?**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      json: progressPayload(url.searchParams.get('from')!, url.searchParams.get('through')!),
    });
  });
  await page.route('**/api/v1/progress/panel?**', (route) =>
    route.fulfill({ json: progressPanelPayload() }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Progresso', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Volume por treino' })).toBeVisible();

  // Rótulo e valor de aderência nunca podem se encostar, nem um rótulo invadir a coluna vizinha.
  const collisions = await page.evaluate(() => {
    const problems: string[] = [];
    for (const card of document.querySelectorAll<HTMLElement>('.adherence-card')) {
      const rows = [...card.querySelectorAll<HTMLElement>('.indicator-grid > div')];
      for (const row of rows) {
        const label = row.querySelector('dt')!.getBoundingClientRect();
        const value = row.querySelector('dd')!.getBoundingClientRect();
        const sameLine = label.top < value.bottom && value.top < label.bottom;
        if (sameLine && value.left - label.right < 8) problems.push(row.textContent ?? '');
      }
      for (const row of rows) {
        // Rótulo mais largo que a própria coluna encosta no vizinho: era assim que "Concluídas" e
        // "Parciais" apareciam grudadas dentro do cartão de aderência.
        const label = row.querySelector('dt')!;
        if (label.scrollWidth > label.clientWidth + 1) problems.push(label.textContent ?? '');
      }
    }
    return problems;
  });
  expect(collisions).toEqual([]);

  // Volume vira barra datada: cada linha mantém data, barra e valor sem estourar o cartão.
  const volume = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>('.volume-card')];
    return cards.map((card) => {
      const bounds = card.getBoundingClientRect();
      const fills = [...card.querySelectorAll<HTMLElement>('.volume-bar__fill')];
      return {
        overflow: fills.some((fill) => fill.getBoundingClientRect().right > bounds.right + 1),
        widths: fills.map((fill) => fill.style.width),
      };
    });
  });
  expect(volume).toHaveLength(2);
  expect(volume.every((card) => !card.overflow)).toBe(true);
  expect(volume.map((card) => card.widths)).toEqual([
    ['83%', '100%'],
    ['67%', '100%'],
  ]);
});
