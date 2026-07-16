# Fase 15 — inventário e diagnóstico visual

Data da auditoria inicial: 15/07/2026

Status: em andamento. O inventário de código está concluído; a captura completa de estados e o
aceite humano permanecem pendentes.

## Origem e limite da evidência

- Baseline automatizado disponível: Hoje em 390 × 844 e 1440 × 900.
- Baseline ausente: 768 × 1024, 1920 × 1080 e telas/estados além de Hoje.
- O navegador visual integrado não estava disponível na sessão desta auditoria. Por isso, os dois
  snapshots existentes foram classificados como legado reprovado, não como cobertura da Etapa 15.0.
- Os HTMLs do Stitch continuam apenas como referência histórica da Fase 14. Eles não são contrato de
  aceite e não entram no bundle.

## Skill consultiva

Foi instalada somente `redesign-existing-projects`, de `Leonxlnx/taste-skill`, revisão
`b17742737e796305d829b3ad39eda3add0d79060`, em escopo global do agente Codex. O `SKILL.md` foi lido
integralmente em 15/07/2026.

### Recomendações aplicáveis

- Trabalhar com React e CSS existentes, em cortes pequenos e testáveis.
- Corrigir hierarquia tipográfica, largura de leitura e números tabulares.
- Reduzir cards genéricos, bordas e sombras sem função hierárquica.
- Consolidar paleta, raios, elevação, espaçamento e estados interativos.
- Preservar foco visível e adicionar loading, vazio e erro com geometria estável.
- Usar HTML semântico, nomes acessíveis, alvos adequados e estados ativos inequívocos.
- Evitar larguras rígidas, `z-index` arbitrário, código morto e dependências não verificadas.

### Recomendações rejeitadas neste produto

- Scroll com inércia, parallax, máscaras, entrada escalonada e animações cinematográficas: prejudicam
  previsibilidade, desempenho e reduced motion em uma PWA de registro rápido.
- Grids quebrados, sobreposição decorativa e whitespace agressivo: conflitariam com formulários,
  dados e uso com uma mão.
- Imagens placeholder remotas, Google Fonts e texturas externas: violariam CSP, offline-first e a
  política de assets locais.
- Glassmorphism, spotlight sob cursor e ruído fixo: não comunicam hierarquia funcional e aumentam
  custo visual/GPU.
- Trocar sidebar apenas por ser um padrão comum: o shell deve ser decidido por densidade, foco e
  testes, não por novidade estética.
- `scroll-behavior: smooth` global: navegação entre áreas exige reposicionamento imediato e
  previsível, respeitando reduced motion.

### Pendentes de aceite humano

- Família tipográfica local definitiva e pesos embarcados.
- Permanência da direção escura da Fase 14 ou adoção de uma base mais clara.
- Proporção final do shell desktop e tratamento visual do destaque primário.
- Quantidade de informação inicialmente expandida em dor, medidas e instalação PWA.

## Inventário técnico

| Item                   | Evidência atual                                                                                                             | Diagnóstico                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| CSS de origem          | `apps/web/src/styles.css`, 32.235 bytes                                                                                     | Um arquivo contém estilos legados e o sistema da Fase 14 na mesma cascata.                                         |
| Primitivos             | `Button`, `Card`, `EmptyState`, `Field`, `Icon`, `MetricCard`, `PageHeader`, `ProgressBar`, `StatusBadge`, `VisuallyHidden` | `Card` ainda representa superfícies semanticamente diferentes; faltam `Surface`, `Section`, `Panel` e `FormGroup`. |
| Viewports visuais      | 390 × 844 e 1440 × 900, somente Hoje                                                                                        | Cobertura insuficiente para declarar qualidade responsiva.                                                         |
| Breakpoints CSS        | 34 rem, 47,49/48 rem, 56 rem e legados em 760 px                                                                            | Existem dois conjuntos de breakpoints sobrepostos.                                                                 |
| Elementos persistentes | header sticky, sidebar sticky e navegação mobile fixed                                                                      | Precisam de orçamento único de camadas e teste de sobreposição.                                                    |
| Fontes                 | nomes `Inter` e `Geist`, com fallback de sistema                                                                            | Não há arquivos de fonte locais; o resultado varia por dispositivo.                                                |
| Idioma                 | maioria em pt-BR                                                                                                            | Há enum cru em Hoje e identificadores/payloads técnicos no painel de conflito.                                     |

### Seletores com definições concorrentes

Contagem textual de ocorrências no arquivo único; grupos e media queries podem explicar parte da
repetição, mas não eliminam a cascata concorrente.

| Seletor               | Ocorrências |
| --------------------- | ----------: |
| `.today-layout`       |           7 |
| `.primary-navigation` |           7 |
| `.history-layout`     |           6 |
| `.calendar-day`       |           6 |
| `.card`               |           4 |
| `.button-row`         |           4 |
| `.skip-link`          |           4 |
| `.planning-layout`    |           4 |
| `.analytics-layout`   |           4 |
| `.sync-note`          |           4 |
| `.planning-header`    |           4 |
| `.sticky-action`      |           4 |
| `.pwa-experience`     |           3 |

### Achados por área

#### Shell e PWA

- O CSS legado e o da Fase 14 definem shell, navegação, PWA e skip link em blocos separados.
- A navegação mobile fixed exige padding compensatório distribuído entre layouts de feature.
- O `z-index` mistura valores 10, 20, 30, 35, 40 e 1000 sem token de camada.
- A experiência PWA ainda ocupa uma região global, mesmo quando deveria ser convite contextual.

#### Hoje e runner

- O grid genérico compartilha regras com Planejamento e iguala áreas de conteúdo diferente.
- Métricas usam três colunas no desktop e duas no mobile estreito, gerando a composição 2 + 1.
- O estado de sessão imprime `status` interno diretamente.
- Runner, hábitos, dor e medidas coexistem no mesmo componente de aproximadamente 30 KB.

#### Planejamento

- Catálogo, exercício personalizado, plano recorrente e sessão avulsa vivem em uma tela de
  aproximadamente 14 KB, com formulários concorrentes.
- O desktop usa duas colunas longas; não há estado explícito de etapa ou mestre/detalhe.

#### Histórico

- Calendário usa altura mínima por célula, mas não reserva a geometria completa antes do loading.
- Filtros, navegação mensal e detalhe compartilham a mesma hierarquia de superfície.
- Badges podem crescer sem um limite visual explícito por dia.

#### Progresso e progressão

- KPIs, gráficos e tabelas usam o mesmo padrão de card e formam uma pilha indiferenciada.
- A tabela acessível e o gráfico não possuem contrato único de altura por estado.
- Enums são traduzidos parcialmente e o painel de conflito ainda mostra JSON bruto.

#### Conta e autenticação

- Conta usa seção, card e zonas internas com bordas em níveis sucessivos.
- Textos explicativos não têm um token de largura de leitura independente da largura da página.
- Autenticação e PWA ainda herdam duas gerações de estilos globais.

## Matriz de captura requerida

Cada tela principal deve ser capturada em 390 × 844, 768 × 1024, 1440 × 900 e 1920 × 1080.

| Área         | Padrão   | Loading  | Vazio    | Erro     | Offline  | Pendente | Conflito |
| ------------ | -------- | -------- | -------- | -------- | -------- | -------- | -------- |
| Shell/Hoje   | pendente | pendente | pendente | pendente | pendente | pendente | pendente |
| Planejamento | pendente | pendente | pendente | pendente | pendente | pendente | pendente |
| Histórico    | pendente | pendente | pendente | pendente | pendente | pendente | pendente |
| Progresso    | pendente | pendente | pendente | pendente | pendente | pendente | pendente |
| Progressão   | pendente | pendente | pendente | pendente | pendente | pendente | pendente |
| Conta        | pendente | pendente | pendente | pendente | pendente | pendente | pendente |

## Ordem de correção confirmada

1. Separar a cascata e consolidar tokens/primitivos.
2. Estabilizar shell, navegação, foco, scroll e loading.
3. Redesenhar as features na ordem Hoje, Planejamento, Histórico, Progresso e Conta.
4. Revisar idioma e estados transversais.
5. Capturar, medir e obter aceite humano antes de substituir snapshots.
