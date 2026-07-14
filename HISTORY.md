# Torkout — Histórico de Implementação

Este arquivo é o diário técnico, cronológico e append-only do projeto. Ele registra o que foi efetivamente implementado, como foi verificado e quais decisões ou desvios surgiram. O estado planejado pertence ao `PLAN.md`; o comportamento esperado pertence ao `SPEC.md`.

## Regras de manutenção

- Adicionar uma entrada ao trabalhar ou encerrar cada fase.
- Não reescrever entradas antigas para ocultar decisões; corrigir com nova nota.
- Não incluir segredos, tokens, e-mails reais ou dados pessoais/de saúde.
- Registrar comandos e resultados de forma resumida, incluindo Red e Green.
- Registrar a mensagem do commit de encerramento. O hash fica no histórico Git.
- Fase não possui commit enquanto não estiver integralmente concluída.
- Mudanças de schema devem citar migrações.
- Mudanças arquiteturais devem citar ADRs.

## Modelo de entrada

```markdown
## AAAA-MM-DD — Fase N: nome

**Status:** iniciada | em andamento | bloqueada | concluída
**Commit de encerramento:** não criado | mensagem do commit

### Escopo executado

- ...

### Evidências TDD

- RED — teste/comando: falha esperada e motivo.
- GREEN — teste/comando: sucesso.
- REFACTOR — verificações executadas.

### Alterações técnicas

- Arquivos/componentes/contratos relevantes.
- Migrações: ...
- Endpoints: ...

### Decisões e ADRs

- ...

### Segurança, privacidade e dados

- ...

### Desvios do plano

- Nenhum | descrição, motivo e atualização documental.

### Pendências e riscos conhecidos

- Nenhum | ...

### Próximo passo

- ...
```

## 2026-07-14 — Preparação documental anterior à Fase 0

**Status:** concluída como preparação; implementação não iniciada

**Commit de encerramento:** não criado — o diretório ainda não é um repositório Git

### Escopo executado

- Consolidada a especificação completa do produto em `SPEC.md`.
- Criado plano de implementação em fases e tarefas em `PLAN.md`.
- Criado este formato de histórico.
- Criadas regras operacionais e de TDD em `CLAUDE.md`.
- Registradas as decisões de cadastro público, acesso offline previamente autenticado e progressão automática no produto inicial.

### Evidências TDD

- Não se aplica a comportamento de aplicação; nenhum código foi implementado.
- A verificação automatizada de Markdown será criada na Fase 0 e executada antes do commit de governança.

### Alterações técnicas

- Somente documentação de produto, arquitetura e processo.
- Migrações: nenhuma.
- Endpoints: nenhum.

### Decisões e ADRs

- Stack proposta: React/Vite/TypeScript, Fastify, Drizzle, PostgreSQL e Better Auth.
- Arquitetura local-first com IndexedDB/outbox e PostgreSQL como fonte de verdade sincronizada.
- ADRs formais ainda serão criados na Fase 0.

### Segurança, privacidade e dados

- Nenhum dado real foi gravado.
- A especificação classifica registros de saúde como sensíveis e proíbe conteúdo sensível em logs.

### Desvios do plano

- O diretório estava vazio e sem repositório Git; nenhuma inicialização foi feita sem solicitação explícita.

### Pendências e riscos conhecidos

- Inicializar ou conectar o repositório Git antes de exigir commits de fase.
- Definir licença e endereço público/domínio durante as fases apropriadas.

### Próximo passo

- Executar a Fase 0 do `PLAN.md` e criar o commit de governança somente quando todos os seus critérios estiverem verdes.

## 2026-07-14 — Fase 0: Repositório e governança

**Status:** concluída

**Commit de encerramento:** `chore(phase-0): establish project governance`

### Escopo executado

- Inicializado repositório Git na branch principal `main`.
- Adicionados `.editorconfig`, `.gitattributes` e `.gitignore` para o futuro monorepo TypeScript.
- Definida licença proprietária provisória, adequada ao caráter pessoal atual do projeto.
- Criado `CONTRIBUTING.md` com fluxo de trabalho, branches, Semantic Versioning, Conventional Commits e política de dependências.
- Criado processo de ADR com template e índice.
- Aceitos ADRs de stack tecnológica, sincronização local-first e autenticação.
- Criado verificador automatizado de governança compatível com Windows PowerShell.

### Evidências TDD

- RED inválido inicial — `& .\scripts\verify-governance.ps1`: o script falhou por incompatibilidade do Windows PowerShell com `Path.GetRelativePath`; o verificador foi corrigido antes de aceitar a evidência.
- RED válido — `& .\scripts\verify-governance.ps1`: falhou listando os nove artefatos de governança ainda ausentes.
- GREEN inicial — `& .\scripts\verify-governance.ps1`: passou para 13 arquivos obrigatórios e 10 arquivos Markdown.
- RED de configuração — após exigir normalização Git de fim de linha, o verificador falhou pela ausência de `.gitattributes`.
- GREEN final — `& .\scripts\verify-governance.ps1`: passou para 14 arquivos obrigatórios e 10 arquivos Markdown.
- REFACTOR — verificador revisado para checar repositório/branch, H1 único, blocos cercados, links relativos, IDs duplicados, encoding UTF-8 e um commit esperado por fase; documentos foram normalizados sem espaços finais.

### Alterações técnicas

- Arquivos de configuração: `.editorconfig`, `.gitattributes` e `.gitignore`.
- Automação: `scripts/verify-governance.ps1`.
- Políticas: `CONTRIBUTING.md` e `LICENSE`.
- ADRs: `docs/adr/0001-technology-stack.md`, `0002-local-first-synchronization.md` e `0003-authentication.md`.
- Migrações: nenhuma.
- Endpoints: nenhum.

### Decisões e ADRs

- ADR-0001 aceitou monorepo TypeScript, React/Vite, Fastify, Drizzle, PostgreSQL, Better Auth, Dexie, Workbox, Docker e Coolify.
- ADR-0002 aceitou IndexedDB/outbox, push/pull idempotente, versão otimista e tombstones.
- ADR-0003 aceitou Better Auth, Argon2id, sessões em cookie e autorização offline local de até 30 dias.
- Branch principal definida como `main`; branches curtas são recomendadas para colaboração e opcionais no fluxo pessoal local.
- Semantic Versioning será usado; a primeira abertura pública completa será `1.0.0`.

### Segurança, privacidade e dados

- Nenhum segredo ou dado pessoal foi adicionado.
- `.gitignore` cobre ambientes, chaves, certificados, dumps e backups locais.
- Política de contribuição proíbe vulnerabilidades e dados reais em relatos públicos.

### Desvios do plano

- O verificador precisou evitar uma API ausente no Windows PowerShell instalado; a verificação comportamental permaneceu equivalente.
- Licença proprietária foi escolhida provisoriamente por ausência de intenção declarada de código aberto. Pode ser substituída pelo titular em fase futura.

### Pendências e riscos conhecidos

- Ainda não existem lint Markdown de terceiros ou CI; a Fase 1 incorporará a verificação aos quality gates.
- O canal privado para relato de vulnerabilidades deve ser definido antes da abertura pública.

### Próximo passo

- Iniciar a Fase 1 para criar o monorepo e os gates de qualidade executáveis.

## 2026-07-14 — Fase 1: Monorepo e qualidade básica

**Status:** concluída

**Commit de encerramento:** `chore(phase-1): scaffold monorepo and quality gates`

### Escopo executado

- Criado monorepo `pnpm` com aplicações API/web e pacotes de contratos, domínio, banco e utilitários de teste.
- Configurado TypeScript estrito, sem emissão por padrão e com builds isolados.
- Configurados ESLint flat config, Prettier, Vitest com projetos, Testing Library e Playwright.
- Criados shell web acessível e endpoint Fastify `/health/live`.
- Criada validação tipada de ambiente com Zod.
- Criado PostgreSQL 18 efêmero para testes de integração.
- Criados Dockerfiles de release para API e frontend e `.dockerignore` restritivo.
- Criada CI com jobs separados de qualidade, integração e E2E.
- Fixados Node 24 LTS nos containers/CI, pnpm 11.1.2 e lockfile.

### Evidências TDD

- RED estrutural — `& .\scripts\verify-phase-1.ps1`: falhou com os 30 arquivos iniciais ausentes.
- RED unitário — `pnpm test`: cinco testes falharam pelos comportamentos ainda ausentes em API, ambiente, contrato e UI.
- GREEN unitário — `pnpm test`: três arquivos e cinco testes passaram.
- RED integração — `pnpm test:integration`: falhou com `ECONNREFUSED` antes de subir o banco efêmero.
- RED de infraestrutura — o primeiro PostgreSQL 18 encerrou porque o tmpfs usava o caminho legado `/var/lib/postgresql/data`.
- GREEN integração — após usar `/var/lib/postgresql`, a consulta real `select 1` passou.
- RED de qualidade — formatação/lint detectaram saída JavaScript emitida ao lado do TypeScript por `tsc -b`.
- GREEN/REFACTOR — emissão desabilitada por padrão, artefatos removidos e format, lint, typecheck e build passaram.
- RED de containerização — o gate estrutural falhou quando `.dockerignore` passou a ser exigido.
- GREEN de containerização — gate estrutural passou para 31 arquivos; as duas imagens foram construídas e executadas, com API `ok` e frontend HTTP 200.
- GREEN E2E — Playwright em perfil Chromium móvel passou na abertura do shell.
- GREEN final — instalação congelada, peer check, `pnpm check`, integração PostgreSQL e Playwright passaram em sequência.

### Alterações técnicas

- Workspace: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` e `tsconfig.base.json`.
- Aplicações: `apps/api` e `apps/web`.
- Pacotes: `packages/contracts`, `database`, `domain` e `test-utils`.
- Qualidade: `eslint.config.mjs`, `prettier.config.mjs`, `vitest.config.ts` e `playwright.config.ts`.
- Infraestrutura: `compose.test.yml`, Dockerfiles, `.dockerignore` e `.github/workflows/ci.yml`.
- Verificação: `scripts/verify-phase-1.ps1`.
- Migrações: nenhuma; a modelagem começa na Fase 2.
- Endpoint: `GET /health/live`.

### Decisões e ADRs

- Usado `projects` em `vitest.config.ts`; o arquivo `vitest.workspace.ts` foi evitado por estar descontinuado no toolchain atual.
- TypeScript foi fixado em 5.9 porque a versão 7 instalada inicialmente excedia a faixa suportada pelo `typescript-eslint` 8.63.
- pnpm usa `allowBuilds` e permite exclusivamente o script de instalação do `esbuild`.
- PostgreSQL de testes usa a versão 18 e volume no caminho atual `/var/lib/postgresql`.
- O shell visual é intencionalmente mínimo; funcionalidades de produto pertencem às fases seguintes.

### Segurança, privacidade e dados

- `.env.example` contém somente credenciais locais fictícias.
- `.dockerignore` impede envio de ambientes, dependências, dumps, backups e relatórios ao contexto Docker.
- API não registra requests nesta fase e o health check não expõe dependências ou configuração.
- pnpm bloqueia scripts de dependência não aprovados; somente `esbuild` está autorizado.
- Nenhum dado pessoal real foi criado.

### Desvios do plano

- Node local permaneceu em 22.22.2, ainda compatível com o toolchain; containers e CI usam Node 24.18.0 LTS.
- O verificador estrutural passou de 30 para 31 arquivos ao incorporar `.dockerignore` como requisito.
- A primeira instalação tentou TypeScript 7 e `onlyBuiltDependencies`; ambos foram corrigidos antes do fechamento por incompatibilidade/obsolescência no pnpm 11.

### Pendências e riscos conhecidos

- O Dockerfile web ainda usa configuração padrão do Nginx; hardening e roteamento SPA final pertencem às fases 11 e 12.
- Logging estruturado da API será habilitado junto das políticas de redação, sem dados sensíveis.
- Os pacotes de domínio e banco contêm apenas fundação; schema e regras começam na Fase 2.

### Próximo passo

- Iniciar a Fase 2 com testes de migração, schema fundamental, constraints e utilitários temporais.

## 2026-07-14 — Fase 2: Banco, contratos fundamentais e datas

**Status:** concluída

**Commit de encerramento:** `feat(phase-2): establish database and core contracts`

### Escopo executado

- Configurados Drizzle ORM/Kit, cliente PostgreSQL e executor de migrações para aplicação e CLI.
- Criado schema com as 30 tabelas especificadas para identidade, privacidade, planejamento, execução, hábitos, corpo, progressão, sincronização e auditoria.
- Padronizados UUID gerado pelo banco, `timestamptz`, versão otimista, atualização automática e tombstones nas entidades sincronizáveis.
- Modeladas as quatro tabelas exigidas pelo Better Auth, incluindo unicidade de e-mail sem distinção de caixa.
- Criados checks, índices, chaves estrangeiras e unicidades para consistência de séries, ordens, datas, valores, hábitos, dor e progressão.
- Criados snapshots de exercício nas sessões para impedir que alterações posteriores reescrevam o histórico.
- Criado catálogo global inicial com Flexão e Agachamento livre e versão inicial auditável das regras de progressão.
- Criados utilitários baseados em Temporal para UTC, data civil e fuso IANA, incluindo rejeição de horários inexistentes ou ambíguos.
- Criadas factories determinísticas com domínio `.invalid`, sem dados pessoais reais.
- Criado gate estrutural específico da fase e incluído no comando raiz `pnpm check`.

### Evidências TDD

- RED estrutural — `pnpm verify:phase-2`: falhou enumerando 15 contratos ausentes, ausência de migração e scripts de banco.
- RED de migração — `pnpm test:integration`: em PostgreSQL real e banco limpo, falhou porque ainda não existia o journal de migrações.
- GREEN de migração/schema — `pnpm test:integration`: duas suítes e seis testes passaram após aplicar as duas migrações.
- RED temporal comportamental — teste de horário inexistente na transição de verão falhou porque a conversão aceitava o horário por compatibilidade.
- GREEN temporal — quatro testes passaram após tornar a desambiguação estrita e emitir erro em português.
- GREEN estrutural — `pnpm verify:phase-2`: passou para 15 arquivos obrigatórios e duas migrações versionadas.
- REFACTOR — schemas foram separados por contexto, exports centralizados e metadados sincronizáveis aplicados por convenção única.
- GREEN final — instalação com lockfile congelado, peer check, `pnpm check`, seis testes de integração PostgreSQL e E2E móvel passaram em sequência.

### Alterações técnicas

- Configuração: `drizzle.config.ts` e scripts `db:generate`, `db:migrate` e `verify:phase-2`.
- Banco: cliente, migrador, schemas Drizzle, duas migrações SQL e metadados do Drizzle Kit.
- Domínio: conversão temporal com `@js-temporal/polyfill`.
- Testes: integração PostgreSQL do schema e testes unitários temporais.
- Dados iniciais: somente catálogo técnico e regras globais; nenhum histórico pessoal foi inserido.
- Endpoints: nenhum; API de aplicação começa em fases posteriores.

### Decisões e ADRs

- Mantidas as decisões dos ADRs 0001–0003; nenhuma mudança arquitetural exigiu novo ADR.
- Entidades sincronizáveis recebem `version` e `deleted_at`; entidades imutáveis, de autenticação ou append-only mantêm apenas os metadados pertinentes.
- Datas civis são armazenadas como `date`, instantes como `timestamptz` e o fuso IANA usado no planejamento fica gravado no próprio registro histórico.
- Atualizações em entidades sincronizáveis incrementam a versão no PostgreSQL por trigger, evitando dependência da disciplina de cada cliente.
- Catálogo de sistema usa UUIDs determinísticos reservados; fixtures usam UUIDs e endereços fictícios estáveis.

### Segurança, privacidade e dados

- Nenhuma senha, token, segredo ou dado pessoal real foi adicionado.
- Credenciais presentes na configuração são exclusivamente fixtures locais do PostgreSQL efêmero.
- Aceites de privacidade guardam somente hash de IP opcional e família minimizada de user agent.
- `audit_events` contém metadados operacionais genéricos e não exige nem armazena conteúdo de saúde.
- Isolamento por usuário foi incorporado às chaves e índices; a autorização de consultas será implementada na API nas fases 3 e seguintes.

### Desvios do plano

- A migração foi dividida em uma parte gerada para o schema e uma parte customizada para triggers e seeds globais, preservando revisão e reprodutibilidade.
- O PostgreSQL retornou inicialmente `date` como objeto no driver; o teste passou a comparar sua representação SQL textual para validar a data civil sem conversão implícita de fuso.

### Pendências e riscos conhecidos

- Better Auth ainda não está integrado; esta fase entrega apenas o schema compatível e a integração pertence à Fase 3.
- O `change_log` e as operações idempotentes estão modelados, mas seu preenchimento e protocolo push/pull pertencem à Fase 4.
- Validação de existência de fusos IANA ocorre na camada de domínio; PostgreSQL armazena o identificador textual para preservar portabilidade.
- Políticas de retenção de tombstones, auditoria e backups serão operacionalizadas nas fases específicas.

### Próximo passo

- Fase 2 encerrada. A Fase 3 não foi iniciada por solicitação explícita de parada após esta fase.
