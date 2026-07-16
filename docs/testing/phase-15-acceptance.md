# Fase 15 — evidência e aceite visual

Status: retorno do aceite humano implementado, validação técnica repetida e rodada final aprovada;
dispositivos físicos aprovados pelo titular; snapshots novos permanecem pendentes.

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
| 1440 × 900  | cinco áreas                                            | sem overflow; outlet em largura total  |
| 1920 × 1080 | cinco áreas                                            | sem overflow; outlet em largura total  |

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

Em 16/07/2026, uma terceira auditoria no Chrome tratou o ritmo interno como contrato transversal,
e não como ajuste isolado da tela Hoje:

| Área                | Antes                                         | Depois                                          |
| ------------------- | --------------------------------------------- | ----------------------------------------------- |
| Hoje — hábitos      | labels encostadas no controle anterior        | 8 px label/controle e 16 px campo/campo         |
| Hoje — sessão vazia | divisor junto ao título; ícone separado       | 16 px após título/divisor; ícone na mesma linha |
| Plano semanal       | 4 px dentro e 12 px entre campos              | 8 px dentro e 16 px entre campos                |
| Sessão avulsa       | labels consecutivas com 0 px                  | agrupador explícito com gap de 16 px            |
| Histórico           | filtros em 12 px e campos do registro em 8 px | campos separados por 16 px                      |
| Progresso e Conta   | `h2` e conteúdo separados por 12 px           | `h2` e primeiro conteúdo separados por 16 px    |

O teste Playwright `phase 15 preserves internal field and heading rhythm across authenticated
pages` percorre Hoje, Catálogo, Plano semanal, Sessão avulsa, Histórico, Progresso e Conta. Ele
mede a geometria computada e falha abaixo de 8 px entre label/controle ou 16 px entre campos e entre
`h2`/conteúdo.

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
os snapshots reprovados. Em 16/07/2026, o titular confirmou separadamente que executou e aprovou
o checklist AC-09 em iPhone, Android/Chrome e desktop físicos. Modelos, versões e capturas não
foram registrados; a evidência disponível é a declaração direta do titular.

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
