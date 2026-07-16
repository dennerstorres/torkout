# Fase 15 — evidência e aceite visual

Status: retorno do aceite humano implementado, validação técnica repetida e rodada final aprovada;
snapshots novos e dispositivos físicos permanecem pendentes como evidência de lançamento.

## Matriz verificada em Chrome

Em 15/07/2026, a extensão do Chrome foi conectada ao ambiente local autenticado em
`http://127.0.0.1:5173`. Hoje, Planejamento, Histórico, Progresso e Conta foram percorridos com dados
de teste, incluindo criação offline-first de sessão avulsa e abertura do runner.

| Viewport    | Áreas verificadas                                      | Resultado técnico                      |
| ----------- | ------------------------------------------------------ | -------------------------------------- |
| 320 × 720   | Hoje e fim do conteúdo                                 | sem overflow; barra não cobre ação     |
| 360 × 844   | Hoje e navegação                                       | sem overflow; foco/destino coerentes   |
| 390 × 844   | cinco áreas, planejamento, runner e laboratório visual | revisão técnica e geometria concluídas |
| 430 × 844   | Hoje e fim do conteúdo                                 | sem overflow; barra não cobre ação     |
| 768 × 1024  | cinco áreas                                            | sem overflow; destino ativo coerente   |
| 1440 × 900  | cinco áreas                                            | sem overflow; largura por feature      |
| 1920 × 1080 | cinco áreas                                            | sem overflow; shell não cresce demais  |

Em 15/07/2026, uma segunda rodada respondeu aos apontamentos detalhados do aceite. As medições antes
e depois foram:

| Contrato                               |                             Antes |                                            Depois |
| -------------------------------------- | --------------------------------: | ------------------------------------------------: |
| Hoje desktop — composição complementar | Dor 333 px órfã na coluna direita | Hábitos, Dor e Peso no mesmo eixo; 403/302/302 px |
| Planejamento — título/lista            |                              0 px |                                             16 px |
| Progressão — Voltar/eyebrow            |                              0 px |                                             24 px |
| Conta — checkbox/botões                |                              0 px |                                             16 px |

A autenticação também foi revisada em 390 × 844 e 1440 × 900: landing sem overflow; modal desktop
com 480 px; folha mobile em largura total; foco inicial em Fechar e PWA silenciosa fora do fluxo.
Favicon, marca da landing, Apple Touch Icon e ícones instaláveis passaram a compartilhar o mesmo
SVG oficial; dimensões, transparência, pixels de controle e área segura maskable foram verificadas.

O teste Playwright `phase 15 layout invariants` mede as quatro larguras mobile. O teste de transição
parte do fim da página e exige, na mesma troca, scroll no topo, foco no `h1` e `aria-current` no
destino correspondente.

## Estados e jornadas

- Sincronizado e pending foram verificados no Chrome; a sessão avulsa foi persistida localmente e
  apareceu em Hoje como “Salvo localmente”.
- Offline, reconexão, retry idempotente e reload com outbox foram validados por E2E.
- Conflito possui teste de componente com campos traduzidos, sem JSON, tipo de entidade, operação,
  estado ou erro interno exposto.
- Loading, vazio e erro permanecem cobertos por testes de componente/E2E; o calendário reserva
  geometria durante a carga.
- Axe WCAG AA, skip link e navegação por teclado permanecem verdes. Reduced motion, forced colors e
  safe areas possuem fallbacks estruturais verificados.

## Gates executados

- `pnpm check`: verde, incluindo governança, Fases 1–15, segurança, formatação, lint, tipagem, 155
  testes unitários e build de produção.
- `pnpm test:integration` com PostgreSQL dedicado `torkout_test`: 50/50 testes verdes.
- E2E funcional: 29 cenários verdes quando os dois snapshots legados são excluídos. A cobertura
  inclui 320/360/390/430 px, tablet retrato/paisagem, 1366/1440/1920 px, zoom textual de 200%,
  reduced motion, forced colors e geometria assíncrona de Histórico e Progresso.
- Baselines da Fase 14 continuam marcados como reprovados e não foram atualizados automaticamente.

## Aceite registrado e evidências ainda necessárias

O titular aprovou a rodada final das telas abertas no Chrome em mobile e desktop e autorizou o
commit e o push em 15/07/2026. Essa aprovação encerra a implementação, mas não autoriza reutilizar
os snapshots reprovados. O checklist AC-09 em iPhone, Android/Chrome e desktop físico continua
necessário; emulação e extensão do Chrome não substituem essa evidência.

| Área           | Mobile | Desktop | Decisão humana |
| -------------- | ------ | ------- | -------------- |
| Hoje/runner    | pronta | pronta  | aprovado       |
| Planejamento   | pronta | pronta  | aprovado       |
| Histórico      | pronta | pronta  | aprovado       |
| Progresso      | pronta | pronta  | aprovado       |
| Conta          | pronta | pronta  | aprovado       |
| Login/registro | pronta | pronta  | aprovado       |

Os PNGs da Fase 14 continuam sendo apenas baseline legado reprovado. Novos snapshots devem ser
gerados em uma rodada própria e nunca promovidos automaticamente a partir desses arquivos.
