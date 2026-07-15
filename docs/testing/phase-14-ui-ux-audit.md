# Fase 14 — auditoria UI/UX premium

Data: 15/07/2026

## Escopo implementado

- Design system local com tokens semânticos, SVGs React e primitivos acessíveis.
- Shell autenticado com navegação inferior em telas pequenas, sidebar no desktop e Hoje como entrada.
- Sincronização global expansível, preservando pending, retry, exportação e conflitos.
- Dashboard Hoje separado do runner, com persistência local anterior à sincronização.
- Planejamento, histórico master/detail, indicadores com tabelas, progressão estruturada e Conta por áreas.
- Temas de loading, vazio, erro, offline, pending e conflito; reduced motion, forced colors e safe areas.

## Evidências automatizadas

- Componentes: papéis, labels, disabled, progresso e quatro variantes transversais de sincronização.
- Playwright: jornadas funcionais offline/online, axe WCAG AA e baselines em 390 × 844 e 1440 × 900.
- Assets: nenhuma dependência runtime de Tailwind CDN, Google Fonts ou Material Symbols.
- Bundle: `AnalyticsScreen` continua carregado de forma lazy.

## Referências visuais

- `e2e/visual.spec.ts-snapshots/today-mobile-chromium-mobile-win32.png`
- `e2e/visual.spec.ts-snapshots/today-desktop-chromium-mobile-win32.png`

## Limite da evidência

Os testes automatizados validam viewports e regras CSS, mas não substituem o checklist físico de AC-09 em
iPhone, Android e desktop. Esse gate continua bloqueando o lançamento público conforme a Fase 13.
