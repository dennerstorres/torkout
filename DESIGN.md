# Sistema de design do Torkout

**Status:** contrato visual obrigatório
**Versão:** 1.1 — Fase 15, adendo de ritmo interno
**Fonte executável:** `apps/web/src/styles/tokens.css` e arquivos importados por `apps/web/src/styles.css`

Este documento define como o Torkout deve parecer e se comportar. Toda alteração de interface deve
seguir estas regras. Quando código e documento divergirem, a mudança só está concluída depois de
alinhar ambos e validar o laboratório `/design-system`.

## 1. Princípios

1. **Clareza antes de decoração.** A ação principal e o estado atual aparecem antes de métricas,
   explicações e ações secundárias.
2. **Calmo, direto e pessoal.** O produto usa uma base escura verde-neutra e apenas um acento lima.
   Não usa gradiente azul/roxo, sombras pretas genéricas nem cartões para todo bloco de conteúdo.
3. **Mobile first, desktop composto.** A ordem semântica é definida para 320 px; telas maiores
   reorganizam a mesma informação sem deixar cartões órfãos ou criar grandes vazios.
4. **Ritmo explícito.** Label e seu controle usam 8 px; campos irmãos e título/conteúdo usam
   16 px; grupos distintos usam 20–32 px. Título, divisor, lista, formulário e ações nunca dependem
   da margem padrão do navegador.
5. **Estados honestos.** Offline, pendente, erro, vazio, carregando e sincronizado devem ser visíveis
   e descritos em português. O produto não apresenta inferências médicas como diagnóstico.
6. **Acessibilidade é estrutural.** Teclado, leitor de tela, zoom de 200%, contraste forçado e redução
   de movimento pertencem ao componente, não a uma etapa posterior.

## 2. Tokens obrigatórios

Valores arbitrários são proibidos em componentes. Um valor novo deve primeiro virar token ou ter
uma justificativa óptica documentada no CSS.

### 2.1 Cores

| Token                         |                    Valor | Uso                                  |
| ----------------------------- | -----------------------: | ------------------------------------ |
| `--color-canvas`              |                `#0b0f0e` | fundo principal                      |
| `--color-canvas-soft`         |                `#0f1513` | campos, navegação e áreas rebaixadas |
| `--color-surface`             |                `#151b19` | cartões e blocos elevados            |
| `--color-surface-raised`      |                `#1a2320` | botões, modal e métricas             |
| `--color-surface-highlighted` |                `#202d27` | hover, seleção e destaque            |
| `--color-border`              | `rgb(202 222 211 / 16%)` | divisores e contornos comuns         |
| `--color-border-strong`       | `rgb(202 222 211 / 30%)` | controles e limites importantes      |
| `--color-text`                |                `#f2f6f3` | texto principal                      |
| `--color-text-muted`          |                `#a7b3ad` | texto de apoio                       |
| `--color-text-subtle`         |                `#7e8d85` | metadados não essenciais             |
| `--color-primary`             |                `#b7df4b` | única cor de ação e foco             |
| `--color-primary-strong`      |                `#cef46a` | hover e destaque de texto            |
| `--color-primary-ink`         |                `#101600` | texto sobre o acento                 |
| `--color-danger`              |                `#ff7b73` | erro e ação destrutiva               |
| `--color-warning`             |                `#efbd68` | alerta e segurança                   |
| `--color-success`             |                `#92d6aa` | sincronização e confirmação          |

Fundos semânticos usam as variantes `--color-danger-soft`, `--color-warning-soft` e
`--color-success-soft`. Branco translúcido pode ser usado somente como microtextura de superfície,
entre 1,5% e 3%. O texto normal deve atingir WCAG AA; foco e estados não podem depender apenas da
cor.

### 2.2 Espaçamento

A unidade é 4 px (`0.25rem`). A escala fechada é:

| Token        |  px | Uso esperado                                                |
| ------------ | --: | ----------------------------------------------------------- |
| `--space-1`  |   4 | ajuste óptico e label interna                               |
| `--space-2`  |   8 | itens muito relacionados e botões em grupo                  |
| `--space-3`  |  12 | conteúdo interno compacto                                   |
| `--space-4`  |  16 | distância padrão entre campos, título/lista e grupos locais |
| `--space-5`  |  20 | seção compacta e padding mobile                             |
| `--space-6`  |  24 | separação de seções e padding desktop                       |
| `--space-8`  |  32 | blocos distintos e superfície espaçosa                      |
| `--space-10` |  40 | respiro de destaque                                         |
| `--space-12` |  48 | área hero e separação excepcional                           |

Regras de ritmo:

- label → controle: 8 px;
- campo completo → próximo campo completo: 16 px, inclusive quando cada campo é um `label`;
- título → lista/conteúdo: 16 px;
- título → divisor e divisor → primeiro conteúdo relacionado: 16 px;
- opção/checkbox → grupo de botões: 16 px;
- barra Voltar → eyebrow/cabeçalho: 24 px;
- itens de lista: 8 px; cartões irmãos: 12–16 px;
- seções com divisor: 24 px de padding vertical;
- nenhum par de elementos independentes pode terminar com intervalo visual de 0 px.

O ritmo de um formulário possui dois níveis independentes e obrigatórios: o espaço **interno** do
campo (`label` → controle, `--space-2`) e o espaço **entre** campos completos (`--space-4`). O pai
de campos repetidos deve declarar `display: grid` ou `flex` e `gap: var(--space-4)`; não se pode
usar o fluxo de bloco ou margens padrão como separação implícita. Ícone e título que descrevem o
mesmo estado ficam na mesma linha, centralizados verticalmente, enquanto houver espaço; somente um
breakpoint justificado pode empilhá-los.

### 2.3 Raios, sombras e camadas

| Token              |                          Valor | Uso                        |
| ------------------ | -----------------------------: | -------------------------- |
| `--radius-xs`      |                         7,2 px | marca e código             |
| `--radius-sm`      |                        11,2 px | controles e itens internos |
| `--radius-md`      |                          16 px | métricas e agrupadores     |
| `--radius-lg`      |                        21,6 px | cartões, painéis e modal   |
| `--shadow-popover` | `0 20px 56px rgb(0 0 0 / 45%)` | somente modal/popover      |

Camadas: base `0`, sticky `20`, navegação `30`, popover `40`, dialog `50`. Não criar `z-index`
arbitrário. A iluminação parte do topo: elevação usa borda clara sutil e sombra para baixo.

## 3. Tipografia

- Corpo: `Segoe UI Variable Text`, `Segoe UI`, `system-ui`, `-apple-system`, `sans-serif`.
- Títulos: `Segoe UI Variable Display`, com o mesmo fallback.
- Corpo padrão: tamanho do navegador (16 px), line-height 1,6; largura máxima 65 caracteres.
- `h1`: `clamp(32px, 4vw, 48px)`, peso 760, line-height 1,02, tracking `-0.045em`.
- `h2`: `clamp(18,4px, 2vw, 23,2px)`, peso 720, line-height 1,15.
- `h3`: 16,8 px, line-height 1,25.
- Eyebrow: 11 px, peso 760, tracking `0.14em`, caixa alta; apenas uma por cabeçalho.
- Label: 14 px, peso 650. Ajuda: 12,8 px, peso 450.
- Métricas e números usam `font-variant-numeric: tabular-nums` quando comparáveis.
- Títulos usam `text-wrap: balance`; parágrafos usam `text-wrap: pretty`.

Não importar fonte remota sem decisão explícita de privacidade, desempenho e disponibilidade
offline.

### 3.1 Marca e ícones de instalação

- a fonte oficial é `/icons/torkout-source.svg`: T escuro sobre quadrado lima inclinado;
- login, shell autenticado e favicon usam diretamente essa mesma fonte vetorial;
- Apple Touch Icon e PNGs PWA de 192/512 px são renderizações da fonte oficial;
- o ícone maskable mantém o mesmo símbolo, centralizado na área segura sobre `--color-canvas`;
- não redesenhar a letra, mudar a paleta ou introduzir símbolo paralelo em uma plataforma.

## 4. Dimensões e layout

- largura mínima suportada: 320 px;
- conteúdo estreito: `44rem` (704 px);
- conteúdo padrão: `68rem` (1088 px);
- conteúdo amplo: `--content-wide`, com `84rem` (1344 px);
- navegação lateral desktop: `13.5rem` (216 px);
- header: `3.75rem` (60 px); navegação mobile: `4.25rem` (68 px);
- padding de página: 16–20 px no mobile e `clamp(16px, 2vw, 32px)` no desktop, respeitando
  `safe-area-inset-*`.

Breakpoints canônicos:

- abaixo de `34rem` (544 px): empilhamento estreito e ações com quebra;
- a partir de `48rem` (768 px): formulários em duas colunas quando a leitura permitir;
- a partir de `56rem` (896 px): navegação lateral;
- a partir de `64rem` (1024 px): composições de dashboard e painéis lado a lado.

Grades devem usar `minmax(0, 1fr)` para impedir overflow. No desktop autenticado, o conteúdo ocupa
toda a largura útil restante depois da sidebar; limites de leitura, como 65 caracteres para texto,
são aplicados aos filhos e não ao container principal. Não usar `100vh`; usar `100dvh` com fallback.
Em desktop, cartões irmãos precisam formar um grupo deliberado: nenhum cartão deve ocupar sozinho
a coluna final de uma linha.

## 5. Componentes

### 5.1 Botões e links

- alvo mínimo: 44 × 44 px (`2.75rem`); navegação mobile: mínimo 56 px de altura;
- raio `--radius-sm`; padding 10,4 × 15,2 px;
- primário: fundo/borda `--color-primary`, texto `--color-primary-ink`;
- padrão: `--color-surface-raised`; perigo: `--color-danger-soft`;
- hover altera fundo/borda em `140ms`; pressed desloca 1 px para baixo;
- foco: contorno de 3 px em `--color-primary`, offset de 3 px;
- no máximo uma ação primária por grupo de decisão.
- ações terciárias dentro de modais mantêm alvo mínimo de 44 px e padding de 8 × 12 px; o texto
  fica alinhado por margem óptica negativa e o hover usa acento a 8%, borda sutil e texto lima.

### 5.2 Campos e formulários

- altura mínima 45,6 px; borda forte; raio pequeno; padding 11,5 × 12,8 px;
- o texto do controle usa no mínimo 16 px, independentemente do tamanho da label; abaixo disso o
  Safari no iOS amplia a página ao focar o campo. Reduzir o zoom pela viewport é proibido;
- cada `label` agrupa seu controle com gap de 8 px;
- formulários e agrupadores de campos usam grade ou flex com gap de 16 px entre campos completos;
- é proibido deixar labels consecutivas no fluxo normal sem gap explícito;
- checkbox/radio tem 20 × 20 px e gap de 12 px para o texto;
- erro aparece junto ao formulário com `role="alert"`; sucesso assíncrono usa `role="status"`;
- o botão de envio vem depois de todos os campos e mantém 8–16 px de separação óptica.

### 5.3 Cartões, listas e métricas

- cartão: superfície, borda de 1 px e raio grande; padding fluido de 16–24 px;
- cartão só existe quando comunica agrupamento ou elevação;
- item interno: raio pequeno, fundo branco a 2,5%, padding 12 px;
- lista compacta tem gap 8 px e margem superior explícita de 16 px após o título;
- métrica: altura mínima 84 px, padding 16 px e raio médio.

### 5.4 Navegação e cabeçalho

- mobile: cinco destinos fixos no rodapé, com `safe-area` e destino atual explícito;
- desktop: trilho lateral de 216 px; conteúdo ativo recebe acento lateral de 2 px;
- cabeçalhos alinham eyebrow, `h1`, apoio e ações; a ação Voltar fica em barra própria quando uma
  eyebrow a sucede, com 24 px entre ambas;
- todas as páginas sem saída direta oferecem Voltar ou um destino equivalente.

### 5.5 Modal de autenticação

- a página pública é uma landing curta: marca e acessos no topo, proposta/preview no centro e nota
  de privacidade no rodapé;
- instruções PWA silenciosas não disputam espaço com a landing; avisos contextuais continuam
  visíveis e as instruções completas permanecem em Conta;
- login, cadastro e recuperação abrem em `role="dialog"`, `aria-modal="true"`, com título associado;
- desktop: largura máxima 480 px, centralizado, padding 32 px e fundo desfocado;
- até 544 px: folha inferior em largura total, altura máxima 92dvh, safe-area no rodapé;
- foco inicial vai para Fechar; `Escape`, botão Fechar e clique no backdrop fecham quando não há
  envio em andamento;
- trocar de modo limpa mensagens anteriores; senhas mantêm mínimo de 12 caracteres.

## 6. Contratos por área

- **Hoje:** sessão e ação principal antes das métricas. Hábitos, Dor e Peso formam “Registros
  complementares”; uma coluna no mobile e três colunas equivalentes no desktop. Em estado vazio,
  ícone e título ficam na mesma linha.
- **Planejamento:** tabs antes do conteúdo. Título do catálogo → 16 px → lista → 16 px → formulário.
- **Histórico:** calendário e detalhe lado a lado somente quando há largura; detalhe pode ser sticky.
- **Progresso:** filtros e período antecedem indicadores. Sugestões explicam evidência e decisão;
  Voltar fica 24 px acima da eyebrow.
- **Conta:** seções usam divisores, não cartões aninhados. Checkbox de exportação e botões pertencem
  a um grupo com gap de 16 px. Zona de risco é a última seção.

## 7. Estados, movimento e acessibilidade

- loading usa skeleton com geometria estável; não desloca conteúdo ao concluir;
- vazio explica o estado e oferece uma ação quando existe próximo passo;
- offline e pendente distinguem dado local de dado sincronizado;
- transições: `--duration-fast` 140 ms e `--duration-standard` 190 ms;
- com `prefers-reduced-motion: reduce`, animação e transição caem para 0,01 ms;
- com `forced-colors: active`, controles usam cores de sistema e mantêm bordas visíveis;
- zoom de 200% não pode gerar overflow horizontal nem ocultar ação essencial;
- ordem DOM e ordem visual devem coincidir; não usar CSS `order` para alterar decisões;
- ícones informativos têm nome acessível; decorativos usam `aria-hidden="true"`;
- toda página oferece “Pular para o conteúdo principal”.

## 8. Conteúdo e linguagem

- português do Brasil, sentence case e verbos diretos;
- evitar “Oops”, clichês promocionais, exclamações e promessas vagas;
- enums e códigos internos nunca chegam ao usuário sem tradução;
- datas incluem contexto civil e fuso quando isso muda o significado;
- segurança usa “não substitui orientação profissional” e nunca diagnostica;
- erros informam o que não foi salvo e o próximo passo; não expõem JSON, stack ou IDs internos.

## 9. Governança de mudanças

Uma alteração visual está pronta somente quando:

1. reutiliza tokens existentes ou atualiza primeiro `tokens.css` e este documento;
2. inclui estado normal, hover, pressed, foco, disabled, loading, vazio e erro aplicáveis;
3. foi verificada em 320, 390, 768, 1024, 1440 e 1920 px, mais zoom de 200%;
4. foi verificada com teclado, reduced motion e forced colors;
5. atualiza `/design-system` quando cria ou muda componente reutilizável;
6. inclui teste estrutural e, quando a geometria for parte do contrato, teste E2E visual;
7. não promove snapshots antes do aceite humano em mobile e desktop;
8. atualiza `PLAN.md` e `HISTORY.md` quando altera o contrato da fase.

Para páginas autenticadas, a regressão geométrica deve percorrer Hoje, as três áreas de
Planejamento, Histórico, Progresso e Conta. O teste mede no layout renderizado: 8 px entre label e
controle, 16 px entre campos empilhados e 16 px entre `h2` e seu primeiro conteúdo. Uma correção
local não está concluída se outra rota continuar violando o mesmo contrato.

Valores e padrões não previstos devem ser discutidos como evolução deste contrato, não resolvidos
com CSS local isolado.
