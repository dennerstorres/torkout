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

## 2026-07-14 — Fase 3: Autenticação, cadastro público e privacidade

**Status:** concluída

**Commit de encerramento:** `feat(phase-3): implement secure public authentication`

### Escopo executado

- Integrado Better Auth 1.6 ao Fastify e ao schema Drizzle/PostgreSQL existente, com cadastro público, confirmação de e-mail obrigatória, login, logout, recuperação e exclusão de conta.
- Configurado Argon2id com 64 MiB, três iterações, paralelismo 1, saída de 32 bytes e salt aleatório individual.
- Criado transporte SMTP configurável exclusivamente por ambiente e mensagens textuais para confirmação e recuperação.
- Configurados cookies `HttpOnly`, `Secure` e `SameSite=Lax`, origem confiável, proteção CSRF, CORS restrito e limites temporários específicos para endpoints públicos sensíveis.
- Implementado consumo persistente e atômico de links de confirmação, cobrindo a exigência de rejeitar reutilização que o fluxo JWT padrão da biblioteca não fornecia.
- Implementados documentos públicos versionados, aceites por usuário, onboarding de perfil, medidas iniciais opcionais e ativação dos quatro hábitos iniciais.
- Implementadas listagem/revogação de sessões, papel administrativo mínimo, bloqueio de conta com revogação total e auditoria sem conteúdo de saúde.
- Implementada exclusão com frase explícita e reautenticação por senha, usando a remoção transacional/cascata do Better Auth.
- Criadas telas responsivas e acessíveis para autenticação, recuperação, nova senha, onboarding, sessões e exclusão.
- Implementada autorização local por 30 dias desde a última autenticação online, com bloqueio posterior que preserva dados e outbox.
- Criado gate estrutural `verify:phase-3` e incorporado ao `pnpm check`.

### Evidências TDD

- RED estrutural — `scripts/verify-phase-3.ps1` enumerou os 14 contratos inicialmente ausentes.
- RED unitário — contratos permissivos, senha em texto e autorização offline incompleta falharam em seis assertivas comportamentais antes das implementações.
- GREEN unitário — oito suítes e 24 testes passaram, cobrindo contratos, Argon2id, SMTP, adaptação Fastify, formulários e janela offline.
- RED integração — cadastro, origem e rate limit retornaram `501` antes da configuração do Better Auth; rotas de perfil/privacidade/administração retornaram `404` antes do registro.
- RED de segurança — a reutilização do JWT de confirmação foi aceita pela biblioteca e o login de conta bloqueada criou sessão antes das proteções adicionais.
- GREEN integração — quatro suítes e 19 testes passaram contra PostgreSQL real, incluindo migração limpa, hash, enumeração, token único/expirado, reset, cookies, sessões, isolamento horizontal, bloqueio auditado e exclusão real.
- RED web — as jornadas de autenticação, onboarding, conta, reset e expiração offline falharam antes dos componentes e estados correspondentes.
- GREEN E2E — três jornadas passaram no perfil Chromium móvel: shell público, cadastro/recuperação e onboarding com consentimento explícito.
- REFACTOR — autenticação, rotas de conta, privacidade, perfil e administração foram separadas por módulo; cliente web e componentes foram isolados por responsabilidade.
- GREEN final — instalação congelada, `pnpm check`, integração PostgreSQL, E2E móvel, build e auditoria de dependências passaram.

### Alterações técnicas

- Migração `0002_superb_susan_delgado.sql`: tabela interna `consumed_auth_tokens`, índices e versões iniciais dos três documentos públicos.
- Endpoints Better Auth sob `/auth/*`: cadastro, login/logout, confirmação, reset, sessão e exclusão.
- Endpoints de produto: `GET /api/v1/privacy/documents`, `POST /api/v1/privacy/acceptances`, `GET/PUT /api/v1/profile`, `DELETE /api/v1/account` e `PUT /api/v1/admin/users/:userId/block`.
- Contratos Zod compartilhados para perfil, aceites, exclusão e bloqueio.
- Cliente Better Auth no React e proxy Vite local para `/auth` e `/api`.
- Variáveis novas: `AUTH_BASE_URL`, `AUTH_SECRET`, `TRUSTED_ORIGINS` e configuração `SMTP_*`.

### Decisões e ADRs

- Mantido o ADR-0003; nenhuma mudança arquitetural exigiu novo ADR.
- O plugin administrativo amplo do Better Auth não foi habilitado. Foi criada somente a operação necessária de bloqueio, reduzindo a superfície administrativa e impedindo acesso comum a conteúdo de saúde.
- O rate limit usa memória do processo, adequado ao monólito de instância única atual; uma estratégia compartilhada será exigida antes de escalar horizontalmente.
- Links de confirmação recebem um marcador SHA-256 persistente antes do processamento para garantir consumo no máximo uma vez, inclusive sob concorrência entre instâncias.
- O `esbuild` transitivo legado do Drizzle Kit foi substituído por versão corrigida via override do workspace.

### Segurança, privacidade e dados

- Testes no PostgreSQL confirmam que senhas persistidas começam com `$argon2id$` e nunca contêm o segredo original.
- Respostas de cadastro e recuperação permanecem genéricas; conta não verificada não recebe sessão completa.
- Tokens de confirmação são armazenados somente como SHA-256; tokens de reset usam o armazenamento de verificação com identificador protegido do Better Auth.
- Bloqueio remove sessões existentes, impede novas sessões e registra apenas motivo operacional e expiração.
- Logs continuam desabilitados e nenhum corpo, cookie, senha, token ou conteúdo de saúde é emitido.
- Aceites registram somente versão, instante e família minimizada do user agent; IP é omitido.
- `pnpm audit --prod --audit-level moderate` terminou sem vulnerabilidades conhecidas após o override transitivo.

### Desvios do plano

- A verificação de e-mail da versão adotada do Better Auth usa JWT stateless e aceitava reutilização idempotente; foi acrescentado consumo persistente para cumprir o requisito mais estrito do projeto.
- Os E2E exercitam a UI com fronteiras HTTP controladas; os mesmos fluxos de segurança do backend são cobertos separadamente contra PostgreSQL real para manter o E2E determinístico e sem SMTP externo.

### Pendências e riscos conhecidos

- Rate limit em memória não é compartilhado entre réplicas; não executar múltiplas instâncias públicas antes de adotar armazenamento comum ou limitar o tráfego por proxy.
- O bloqueio offline protege a interface e preserva a outbox, mas o particionamento físico no IndexedDB começa na Fase 4.
- SMTP precisa de credenciais, domínio e DNS reais antes da abertura pública, conforme Fase 12.

### Próximo passo

- Iniciar a Fase 4 com réplica Dexie particionada, outbox e protocolo de sincronização idempotente.

## 2026-07-14 — Fase 4: Fundação de sincronização local-first

**Status:** concluída

**Commit de encerramento:** `feat(phase-4): implement local-first sync foundation`

### Escopo executado

- Criado banco Dexie físico por UUID de usuário, com tabelas tipadas para réplica, outbox, cursor/dispositivo e conflitos.
- Implementada escrita atômica do registro local e sua operação, incluindo coalescência de edições offline consecutivas para evitar conflitos com o próprio dispositivo.
- Implementado coordenador de sincronização com estados `offline`, `pending`, `syncing`, `synced`, `conflict`, `auth-required` e `error`.
- Implementados gatilhos ao abrir, retomar, recuperar conexão e por ação manual, sem depender de Background Sync.
- Implementados `POST /api/v1/sync/push` e `GET /api/v1/sync/pull`, com lote por item, paginação por cursor opaco e isolamento pelo usuário da sessão.
- Implementada idempotência persistente com lock transacional por usuário/operação e armazenamento da resposta original para recuperar queda após commit.
- Implementada concorrência otimista, snapshots no `change_log`, tombstones e resolução explícita com versões local/servidor.
- Criada UI acessível para estado, inspeção, repetição, exportação de pendências e decisão de conflitos.
- Logout agora oferece manter a réplica protegida ou removê-la; exclusão confirmada da conta remove o banco local.
- Implementada retenção mínima: tombstones autoritativos permanecem no servidor e somente tombstones locais já sincronizados são removidos após 90 dias.

### Evidências TDD

- RED de contratos — o scaffold permissivo aceitou combinações inválidas de operação e `baseVersion`; o contrato estrito passou a rejeitá-las sem impedir validação individual do lote.
- RED local — réplica/outbox não sobreviveram à reabertura, sessão expirada não preservou envio e a UI não expôs estado/conflito antes da implementação.
- RED de coalescência — uma edição após criação offline falhou por não possuir versão do servidor; a mutação passou a atualizar atomicamente a operação pendente original.
- RED de transporte — metadados internos da outbox seriam enviados ao contrato estrito; o coordenador passou a projetar somente o envelope público.
- RED de API — todos os seis cenários retornaram `404` antes do registro das rotas.
- GREEN local — sete cenários determinísticos passaram com IndexedDB simulado: reload, isolamento, coalescência, reautenticação, queda pós-commit, não ressurreição e retenção.
- GREEN API — seis cenários passaram contra PostgreSQL real: lote parcialmente inválido, repetição idempotente, conflito, reordenação, pull/tombstone paginado e dispositivo isolado.
- GREEN UI/contratos — quatro testes de contrato/componente passaram para validação estrita, inspeção, exportação, repetição e resolução.
- REFACTOR — transporte HTTP, banco local, coordenador, hook React, painel e registro de adaptadores do servidor foram separados por responsabilidade.
- GREEN final — `pnpm check`, 25 testes de integração PostgreSQL, três E2E móveis, build e auditoria de dependências passaram.

### Alterações técnicas

- Migração `0003_phase_4_sync.sql`: adiciona snapshot JSON ao `change_log` e resposta idempotente persistida às `sync_operations`.
- Contratos Zod compartilhados para operações, resultados, registros, push e pull de sincronização.
- Registro extensível de adaptadores com `body_measurement` como primeira entidade representativa completa; fases seguintes adicionam entidades sem alterar o protocolo.
- Cursor de pull codifica versão e sequência sem expor consulta cross-user; todas as buscas continuam filtradas pelo usuário autenticado.
- Dependências novas: Dexie 4 para IndexedDB e `fake-indexeddb` apenas para testes, ambas Apache-2.0.
- Gate estrutural `verify:phase-4` incorporado ao `pnpm check`.

### Decisões e ADRs

- Mantido o ADR-0002; a implementação concretiza sua estratégia sem introduzir CRDT, fila, WebSocket ou Background Sync.
- Resultados rejeitados e conflitos válidos também são persistidos por `operationId`, garantindo que uma repetição nunca mude retroativamente o resultado observado.
- Operações malformadas são rejeitadas individualmente e não entram na tabela idempotente porque podem não possuir identidade válida.
- A limpeza local exige simultaneamente tombstone sincronizado e idade superior a 90 dias; pendências e conflitos nunca são removidos pelo coletor.

### Segurança, privacidade e dados

- O nome físico do IndexedDB contém somente o UUID técnico e bancos de usuários distintos não compartilham tabelas nem consultas.
- `userId` nunca é aceito no payload de sincronização; autorização deriva exclusivamente da sessão.
- Um UUID de dispositivo já pertencente a outro usuário retorna `unauthorized` sem revelar ou alterar o registro.
- Outbox não é apagada por expiração de sessão, falha de rede ou logout com preservação escolhida.
- Logs permanecem sem corpos ou conteúdo de saúde; o protocolo não adicionou logging de payload.
- `pnpm audit --prod --audit-level moderate` não encontrou vulnerabilidades conhecidas.

### Desvios do plano

- A fundação registra um adaptador completo de medição corporal como prova do motor genérico. Exercícios, templates e planejamento entram na Fase 5 usando o mesmo registro, evitando antecipar CRUD daquela fase.
- Tombstones do PostgreSQL não são apagados automaticamente nesta fase: a retenção é deliberadamente conservadora até existir reconciliação integral para dispositivos inativos. A limpeza segura de 90 dias já é aplicada à réplica local sincronizada.

### Pendências e riscos conhecidos

- IndexedDB protege isolamento lógico/físico por conta, mas não oferece criptografia própria; a segurança continua dependendo do bloqueio do dispositivo e da janela offline de 30 dias.
- O protocolo suporta uma entidade representativa; cada nova entidade exige schema Zod e adaptador transacional específico nas fases funcionais.
- Conflitos são resolvidos por registro completo nesta fundação. Mesclagens de campos somente serão adicionadas quando houver regra determinística específica e testada.

### Próximo passo

- Iniciar a Fase 5 com exercícios, planos, templates e materialização futura sobre a fundação local-first concluída.

## 2026-07-14 — Fase 5: Exercícios, templates e planejamento

**Status:** concluída

**Commit de encerramento:** `feat(phase-5): implement workout planning`

### Escopo executado

- Implementados contratos Zod para exercícios personalizados, planos, templates, séries por métrica, regras semanais, sessões avulsas e janelas de materialização.
- Implementado CRUD autenticado sob `/api/v1/exercises`, `/api/v1/plans` e `/api/v1/templates`, com concorrência otimista, desativação/arquivamento e isolamento horizontal.
- Implementados `/api/v1/sessions`, reagendamento, cancelamento e `POST /api/v1/sessions/materialize` com janela máxima de 120 dias.
- Criado materializador puro por data civil, horário local e fuso IANA, aceitando múltiplas regras no mesmo dia e preservando snapshots de exercícios, métricas e alvos.
- Alterações de template com `effectiveFrom` removem somente materializações futuras ainda planejadas; sessões iniciadas ou concluídas mantêm o snapshot anterior.
- Ampliada a sincronização local-first para os agregados `exercise`, `training_plan`, `workout_template` e `workout_session`, mantendo idempotência, versão, tombstone, pull incremental e conflito explícito.
- Criada tela mobile-first de planejamento com catálogo inicial, exercício personalizado, plano semanal, segunda/sexta, horário local, sessão avulsa, reagendamento, cancelamento e ação manual de sync.
- Criada jornada Playwright que planeja durante falha da API, recarrega pela identidade offline, confirma persistência no IndexedDB e envia a outbox após a conexão retornar.

### Evidências TDD

- RED de domínio — o módulo de planejamento não existia; três testes falharam antes da implementação do materializador.
- GREEN de domínio — segunda/sexta, `America/Cuiaba`, múltiplas sessões, idempotência, snapshot e vigência futura passaram em testes puros.
- RED de contratos — payloads de planejamento e métricas específicas eram rejeitados ou inexistentes; os contratos estritos passaram a validar cada alvo aplicável.
- RED de API — exercícios, planos, templates e sessões retornaram `404` antes do registro das rotas; seis cenários de integração passaram contra PostgreSQL real.
- RED de sync — agregados de planejamento causaram falha no push; o registro de adaptadores passou a persistir e devolver os quatro tipos no pull incremental.
- RED de UI — a tela de planejamento não existia; o teste de componente passou após comprovar dado e operação na mesma réplica Dexie.
- GREEN final — `pnpm check` passou com 43 testes unitários/componentes, `pnpm test:integration` passou com 31 testes PostgreSQL e `pnpm test:e2e` passou com quatro jornadas móveis.
- REFACTOR — contratos, domínio puro, persistência agregada, rotas, adaptadores de sync e componente React foram mantidos em limites separados.

### Alterações técnicas

- Migração `0004_phase_5_planning.sql`: adiciona `schedule_rule_id`, snapshot do nome do template, unicidade por regra/data e corrige dia da semana para ISO (`1` a `7`).
- O backfill da migração preenche nomes de sessões existentes antes de tornar o snapshot obrigatório, permitindo forward migration sem coluna nula.
- A chave única parcial `(schedule_rule_id, planned_local_date)` garante idempotência também sob concorrência no servidor.
- Templates e sessões são sincronizados como agregados: exercícios/séries internos são gravados juntos, evitando estados relacionais parciais na experiência offline.
- O pacote da API passou a depender do pacote de domínio já existente no workspace; nenhuma dependência externa foi adicionada.
- Gate estrutural `verify:phase-5` foi incorporado ao `pnpm check`.

### Decisões e ADRs

- Mantidos os ADRs 0001 e 0002; a fase aplica a arquitetura monolítica e local-first aprovada sem mudança arquitetural que exija novo ADR.
- Dia da semana usa ISO de segunda `1` a domingo `7`, alinhado ao `Temporal` e à preferência inicial de semana do produto.
- A edição recorrente substitui a definição do agregado e rematerializa apenas o futuro planejado; o passado permanece desacoplado por snapshot.

### Segurança, privacidade e dados

- Todas as consultas e mutações de domínio derivam `userId` da sessão; payloads não autorizam acesso e testes confirmam que o segundo usuário não lê nem altera recursos do primeiro.
- Catálogo de sistema é somente leitura para usuários; exercícios personalizados pertencem obrigatoriamente à conta autenticada.
- Push valida referências de plano e exercício dentro do usuário antes de gravar templates.
- Nenhum corpo de treino, nota ou identificador sensível foi adicionado a logs.
- `pnpm audit --prod --audit-level moderate` não encontrou vulnerabilidades conhecidas.

### Desvios do plano

- O materializador é disparado explicitamente pela API dentro de uma janela informada. Agendamento automático periódico fica para a operação de produção, sem afetar idempotência ou a jornada funcional.
- A UI inicial concentra a criação semanal em um exercício por template para manter o fluxo móvel curto; os contratos e APIs já suportam múltiplos exercícios e até 100 séries/exercícios por agregado.

### Pendências e riscos conhecidos

- Edições concorrentes continuam resolvidas no nível do agregado completo, conforme a política da Fase 4; não há merge silencioso de campos internos.
- Sessões futuras só aparecem depois da chamada de materialização; um job operacional poderá antecipar essa chamada quando a janela padrão de produção for definida.
- A tela Hoje, execução real de séries e registros diários pertencem à Fase 6 e ainda não foram iniciados.

### Próximo passo

- Iniciar a Fase 6 com dashboard Hoje, salvamento incremental de execução, dor, hábitos e medidas sobre os snapshots e a sincronização já disponíveis.

## 2026-07-14 — Fase 6: Tela Hoje e registros diários

**Status:** concluída

**Commit de encerramento:** `feat(phase-6): implement daily workout tracking`

### Escopo executado

- Criada a tela Hoje mobile-first com data civil calculada no fuso do perfil, sessões do dia, metas e valores reais independentes, séries adicionais, observações e detalhes de caminhada.
- Implementados estados de exercício concluído, ignorado e interrompido, além do cálculo puro de conclusão total ou parcial da sessão.
- Cada edição de série, hábito, dor, medida ou execução é persistida primeiro na réplica Dexie e na outbox; o formulário incompleto sobrevive a reload sem rede.
- Implementada confirmação explícita de ausência de dor articular com estado inicial `unknown`; ausência de relato nunca é convertida implicitamente em ausência de dor.
- Implementados contratos, API autenticada e sincronização para relatos de dor, definições/entradas de hábitos e execução agregada da sessão.
- Hábitos iniciais de café, arroz, proteína e salada passaram a usar escolhas estáveis e ordenadas; hábitos personalizados continuam aceitando booleano, quantidade, escala ou escolha.
- Implementados registro e consulta de múltiplas medidas de peso/cintura no mesmo dia.
- Criada importação autenticada e idempotente do histórico de 13/07/2026, acionável somente pela interface da conta e nunca inserida como seed global.
- A aplicação hidrata os dados do dia pela API quando há rede, preserva alterações locais pendentes e mantém a tela utilizável quando a hidratação falha.
- Estados `offline`, `pending`, `syncing`, `synced`, `conflict`, `auth-required` e `error` possuem mensagens textuais distintas na jornada diária.

### Evidências TDD

- RED de domínio — o cálculo inicial retornou `completed` para série incompleta e exercício ignorado; a regra passou a produzir `partial` nesses casos.
- RED de contratos — envelopes de execução, dor e hábitos foram rejeitados antes da ampliação estrita do discriminador de entidades e dos schemas diários.
- RED de banco — a migração inicial não possuía `joint_pain_status` nem chave idempotente de importação; o teste PostgreSQL observou zero colunas antes da migração.
- RED de API — execução, dor, hábitos, medidas e importação retornaram `404`; quatro cenários passaram após a implementação e um quinto comprovou os adaptadores de sync por item.
- RED de UI — a tela Hoje exibia somente o título; testes passaram após comprovar salvamento incremental, série adicional, ausência explícita de dor, hábito, medida e restauração via IndexedDB.
- GREEN final — `pnpm check` passou com 17 arquivos de teste e 52 testes unitários/componentes; `pnpm test:integration` passou com 37 testes PostgreSQL e `pnpm test:e2e` passou com cinco jornadas móveis.
- REFACTOR — contratos diários, cálculo puro, rotas/persistência, adaptadores de sync, hidratação e componente React foram mantidos em limites separados.

### Alterações técnicas

- Migração `0005_phase_6_daily_tracking.sql`: cria enum `joint_pain_status`, adiciona confirmação de dor e `import_key` às sessões, observação às caminhadas e unicidade parcial da importação por usuário.
- Novos endpoints: `PUT /api/v1/sessions/:id/execution`, CRUD de `/api/v1/pain-reports`, CRUD/listagem diária de `/api/v1/habits`, `/api/v1/measurements` e `POST /api/v1/daily-history/import`.
- O agregado sincronizável `workout_session` passou a aceitar execução incremental sem misturar alvos planejados com valores reais.
- Novos tipos sincronizáveis: `pain_report`, `habit_definition` e `habit_entry`; todos usam UUID, versão otimista, tombstone, idempotência e change log existentes.
- Adicionado gate estrutural `verify:phase-6` ao `pnpm check`.
- Nenhuma dependência externa foi adicionada.

### Decisões e ADRs

- Mantidos os ADRs 0001 e 0002; a fase estende o monólito modular e o protocolo local-first sem mudança arquitetural.
- Execução permanece um agregado da sessão para que série, estado do exercício, caminhada e confirmação de dor sejam persistidos juntos e não exponham estados relacionais parciais ao cliente.
- A importação histórica usa uma chave funcional privada por usuário, permitindo repetição segura sem seed ou identificador global de titular.
- Hábitos iniciais usam valores estáveis separados de rótulos em português, preservando futura edição textual sem reescrever histórico.

### Segurança, privacidade e dados

- Todas as rotas e adaptadores derivam o titular da sessão; vínculos de dor, série, hábito e opção são validados dentro do mesmo usuário.
- Testes confirmam que outro usuário não consulta sessões nem relatos de dor e que a importação aparece somente na conta autenticada que a solicitou.
- A hidratação online nunca sobrescreve registro local `pending` ou `conflict`.
- Observações, dor, hábitos, medidas e corpos de requisição continuam ausentes dos logs.
- A busca por `TODO`, `.skip` e `.only` não encontrou bypasses; `pnpm audit --prod --audit-level moderate` não encontrou vulnerabilidades conhecidas.

### Desvios do plano

- O GPS continua opcional e não foi introduzido; caminhada aceita distância manual, duração, origem e observação conforme a especificação.
- A importação de 13/07/2026 é um fluxo autenticado específico, e não um importador genérico. Portabilidade e formatos gerais pertencem à Fase 10.

### Pendências e riscos conhecidos

- A tela Hoje carrega somente a data civil atual; navegação e edição histórica geral entram na Fase 8.
- Relatos atrasados já são persistidos com sua própria data e vínculo, mas a invalidação de sugestões pertence ao motor da Fase 7.
- O conflito continua resolvido no nível do agregado completo, conforme a política local-first vigente.

### Próximo passo

- Iniciar a Fase 7 com regras puras, versionadas e explicáveis de progressão sobre as evidências explícitas de execução e dor agora disponíveis.

## 2026-07-14 — Fase 7: Motor de progressão explicável

**Status:** concluída

### Escopo executado

- Implementado motor puro e versionado que avalia duas sessões elegíveis, metas atingidas, confirmação explícita de ausência de dor, sessões perdidas e limites configuráveis por exercício.
- Implementadas as regras conservadoras para dor muscular leve, moderada e forte, bloqueio por qualquer dor articular e interrupção de agachamento diante de dor articular em pé/tornozelo durante o exercício.
- Avaliações persistem evidências imutáveis, hash SHA-256, resultado, regra e versão; a unicidade existente garante idempotência para a mesma evidência.
- Sessões concluídas/parciais e relatos de dor recebidos pela API ou sincronização disparam avaliação. Dor atrasada invalida somente sugestões ainda pendentes e cria uma nova avaliação.
- Criados endpoints de listagem, avaliação explícita e decisão sob `/api/v1/progression`, sempre isolados pelo usuário autenticado.
- Aceite, recusa e adiamento são explícitos. Aceitar novamente devolve a decisão existente sem reaplicar o efeito.
- O aceite de aumento ou redução atualiza o template recorrente e somente sessões futuras ainda planejadas; snapshots históricos permanecem intactos.
- Criada tela mobile de sugestões com explicação, evidências, código/versão da regra e aviso de segurança textual versionado.

### Evidências TDD e validação

- Testes de domínio cobrem aumento, dados ausentes, todas as intensidades musculares, dor articular específica, limites e não negatividade.
- Teste PostgreSQL comprova sugestão única, versão histórica, aceite idempotente e alteração somente de alvo futuro.
- Teste de componente comprova explicação e ação explícita; jornada Playwright cobre revisão e aceite em viewport móvel.
- Gate estrutural `verify:phase-7` foi incorporado ao `pnpm check`.

### Segurança, privacidade e dados

- Consultas, avaliações e decisões derivam o titular da sessão; nenhum `userId` é aceito como autorização.
- Evidências médicas não são registradas em logs e a linguagem evita diagnóstico.
- Toda sugestão persiste e exibe o aviso de que não substitui orientação profissional.

### Próximo passo

- Iniciar a Fase 8 com calendário mensal, detalhe diário e edição histórica sincronizada.

## 2026-07-14 — Fase 8: Calendário e edição histórica

**Status:** concluída

**Commit de encerramento:** `feat(phase-8): implement calendar and history`

### Escopo executado

- Criado calendário mensal responsivo, com semana iniciada na segunda-feira, navegação por mês, seleção por data civil e detalhe diário agregado.
- Cada sessão exibe badges textuais separados de tipo e estado; dias com caminhada e força preservam ambos os pares de badges e suportam múltiplas sessões.
- Implementados filtros combináveis por atividade, estado efetivo e presença de relato de dor.
- Sessões executáveis ainda planejadas em data passada recebem estado `missed` derivado, identificado como tal, com ação explícita para confirmá-lo. Descanso e cancelamento nunca são convertidos automaticamente.
- O detalhe permite corrigir estado e observação da sessão, entrada de hábito, peso/cintura e intensidade/observação de dor por meio da mesma outbox local-first das telas anteriores.
- A edição histórica muta somente os agregados registrados; templates e seus alvos futuros permanecem intactos.
- Dias indicam textualmente pendência e conflito, sem depender apenas de cor.
- Criado endpoint autenticado `GET /api/v1/history` com intervalo de datas, limite de até 31 datas civis, cursor opaco e isolamento pelo titular.
- A tela percorre todas as páginas do mês, preserva registros locais pendentes/conflitantes durante hidratação e permite navegar pelos meses em cache sem rede.

### Evidências TDD e validação

- RED de domínio e contratos — os testes falharam porque regras de calendário, `missed`, filtros e schemas históricos ainda não existiam.
- GREEN de domínio — grade civil iniciada na segunda-feira, descanso/cancelamento, estado perdido e filtros que correlacionam tipo/estado na mesma sessão passaram em cinco testes.
- RED de API — PostgreSQL real respondeu `404` para `/api/v1/history`; após a implementação, paginação, duas atividades na mesma data e isolamento horizontal passaram.
- RED de UI — o componente `HistoryScreen` era inexistente; três testes passaram após comprovar badges múltiplos, descanso, filtros, outbox para quatro agregados e navegação offline.
- RED de configuração — o verificador estrutural falhou pela ausência de `verify:phase-8` antes de ser incorporado ao gate raiz.
- GREEN final — 70 testes unitários/componentes, 40 testes de integração PostgreSQL e sete jornadas Playwright móveis passaram.
- REFACTOR — cálculo de calendário/filtros ficou no domínio puro, schemas no pacote de contratos, consulta agregada na API e persistência/edição na camada web.

### Alterações técnicas

- Novo contrato `historyQuerySchema` limita o intervalo a 366 dias e cada página a 31 datas; o cursor codifica apenas a próxima data autorizada do intervalo e é validado no servidor.
- O endpoint agrega sessões completas, relatos de dor, entradas de hábito, medidas e definições de hábito sem aceitar `userId` do cliente.
- A hidratação reutiliza a proteção que impede dados do servidor de sobrescrever registros locais em estado `pending` ou `conflict`.
- Migrações: nenhuma; as tabelas e índices das Fases 2, 5 e 6 já cobriam o histórico.
- Dependências externas: nenhuma.
- Gate estrutural `verify:phase-8` adicionado ao `pnpm check`.

### Decisões e ADRs

- Mantidos os ADRs 0001 e 0002; a fase amplia a leitura paginada e a interface sobre o monólito modular e a réplica local-first existentes.
- A paginação avança por data civil, inclusive datas sem registro, para que o cliente saiba quando um mês foi percorrido integralmente e possa operar offline de forma determinística.
- `missed` derivado não grava silenciosamente no servidor. A confirmação do titular gera uma mutação sincronizável e auditável pelo change log existente.

### Segurança, privacidade e dados

- Todas as consultas históricas derivam o titular da sessão; teste com segundo usuário confirma que sessões alheias não aparecem.
- Cursor inválido ou fora do intervalo é rejeitado sem revelar existência de registros.
- Notas, dores, hábitos e medidas não foram adicionados a logs.
- A tela continua usando IndexedDB particionado por usuário, e a paginação não usa Cache Storage para dados privados.

### Desvios do plano

- Não houve alteração de schema: a fase foi implementada como consulta paginada, regra derivada e interface sobre entidades sincronizáveis existentes.
- O calendário atenua visualmente dias fora do filtro, mantendo-os focáveis para não remover navegação temporal nem esconder o contexto do mês.

### Pendências e riscos conhecidos

- A réplica mantém os meses efetivamente visitados; não há pré-carregamento ilimitado de todo o histórico.
- Conflitos continuam resolvidos no nível do agregado completo conforme o ADR-0002; o calendário identifica o dia, e o painel geral oferece a decisão entre versão local e servidor.
- Agregações analíticas e gráficos pertencem à Fase 9 e não foram antecipados.

### Próximo passo

- Iniciar a Fase 9 com indicadores e gráficos acessíveis sobre o histórico paginado agora disponível.

## 2026-07-14 — Fase 9: Progresso, indicadores e gráficos

**Status:** concluída

**Commit de encerramento:** `feat(phase-9): implement progress analytics`

### Escopo executado

- Implementado agregado autenticado de progresso com intervalo civil inclusivo e limitado a 366 dias, sem transportar histórico bruto ilimitado ao cliente.
- Criadas séries de peso e cintura que preservam múltiplas medições no mesmo dia e sua ordem de medição.
- Implementados totais e evolução por exercício para repetições, duração ou distância; séries removidas e exercícios ignorados não entram nos totais.
- Implementada consistência semanal `weekly-consistency/v1`: concluída vale `1`, parcial vale `0,5`, perdida vale `0`; descanso e cancelamento não entram no denominador, e semanas vazias retornam percentual desconhecido em vez de zero.
- Implementados totais de sessões concluídas/parciais, distância e frequência de caminhadas e frequência de dor por tipo, intensidade e região.
- Relatos atrasados são atribuídos ao período de sua data civil informada, independentemente do instante de criação.
- Criada tela mobile-first com filtros de 4, 8 e 12 semanas e intervalo personalizado, explicação de período e fórmula, estados vazios e dados insuficientes.
- Todos os gráficos possuem nome acessível e tabela equivalente; a visualização usa Recharts, carregado sob demanda para não aumentar o bundle inicial.
- O último agregado de cada intervalo é armazenado em uma nova tabela Dexie da réplica particionada por usuário e pode ser reaberto offline.

### Evidências TDD e validação

- RED de domínio — os cálculos inicialmente lançavam `Progress analytics are not implemented`; os testes cobriram semanas vazias/parciais, descanso, cancelamento, limites inclusivos, caminhadas, dor atrasada, medições múltiplas e exclusão de séries removidas/ignoradas.
- RED de contratos — ranges e respostas eram rejeitados por schemas `never`; os schemas estritos e o limite inclusivo de 366 dias ficaram verdes.
- RED de API — `GET /api/v1/progress` retornou `404`; depois da implementação, agregação, validação, autenticação e isolamento horizontal passaram no PostgreSQL real.
- RED de UI — a tela exibia apenas indisponibilidade e o gate estrutural acusava a ausência de `verify:phase-9`; filtros, gráficos, tabelas, cache e navegação ficaram verdes.
- GREEN final — `pnpm test` passou com 26 arquivos e 80 testes unitários/componentes; `pnpm test:integration` passou com 10 arquivos e 43 testes PostgreSQL; `pnpm test:e2e` passou com oito jornadas móveis.
- Desempenho — o teste de referência consulta o intervalo agregado máximo dentro da meta de 500 ms para operação comum.
- REFACTOR — cálculo puro, schemas, consulta autenticada, cache local e apresentação ficaram em módulos separados; o módulo Recharts foi isolado em chunk sob demanda.

### Alterações técnicas

- Novo endpoint: `GET /api/v1/progress?from=YYYY-MM-DD&through=YYYY-MM-DD`.
- Novos módulos de domínio e contratos `analytics`, rota `analytics-routes` e tela `AnalyticsScreen`.
- IndexedDB passou da versão 1 para a versão 2 de forma aditiva, com a tabela `analyticsCache`; dados, outbox, conflitos e metadados existentes são preservados.
- Migrações PostgreSQL: nenhuma; os índices por usuário/data e as entidades das fases anteriores já cobriam a consulta.
- Dependência adicionada: Recharts, conforme a stack aprovada no `SPEC.md`; `pnpm audit --prod --audit-level moderate` não encontrou vulnerabilidades conhecidas.
- Gate estrutural `verify:phase-9` incorporado ao `pnpm check`.

### Decisões e ADRs

- Mantidos os ADRs 0001 e 0002. A fase usa o monólito modular e a réplica local-first existentes, sem mudança arquitetural.
- O PostgreSQL calcula a visão autorizada por intervalo e devolve somente o agregado limitado; o cliente guarda apenas resultados recentes por intervalo, não uma segunda fonte de verdade analítica.
- A fórmula semanal possui código de versão explícito e explicação exibida. Uma alteração futura deverá criar nova versão ou documentar recálculo, conforme o `SPEC.md`.

### Segurança, privacidade e dados

- O titular é sempre derivado da sessão; o endpoint não aceita `userId`, e teste com segunda conta comprova isolamento.
- Consultas filtram tombstones e todas as tabelas por `user_id`; notas e payloads de saúde não foram adicionados a logs.
- O cache analítico permanece na IndexedDB exclusiva da conta e segue a mesma limpeza local usada no logout/exclusão.
- Gráficos não fazem afirmação clínica e a tela mantém o aviso de que indicadores não substituem orientação profissional.

### Desvios do plano

- A API usa uma resposta agregada limitada, em vez de cursor sobre pontos brutos. Isso atende ao requisito paginada/agregada e evita carregar histórico ilimitado sem criar paginação artificial sobre séries já resumidas.
- Cancelamentos são excluídos do denominador porque o modelo atual não distingue justificativa; essa é a interpretação conservadora da fórmula aprovada para a versão `v1`.

### Pendências e riscos conhecidos

- A preferência de início da semana permanece segunda-feira, único valor inicial definido pela especificação; uma preferência adicional exigirá nova parametrização da fórmula.
- O cache é mantido por intervalo consultado e não possui política de poda por quantidade nesta fase; continua limitado aos períodos que o titular efetivamente abriu.
- A verificação manual final em iPhone físico pertence às Fases 11 e 13 e ainda não foi executada.

### Próximo passo

- Iniciar a Fase 10 com exportação versionada JSON/CSV, inclusão identificada da outbox e exclusão integral dos dados do titular.

## 2026-07-14 — Fase 10: Exportação, portabilidade e exclusão

**Status:** concluída

**Commit de encerramento:** `feat(phase-10): implement data portability and erasure`

### Escopo executado

- Definido o contrato estrito `dataExportSchema` com `formatVersion: 1.0.0`, instante de geração, fuso, unidades, identidade segura, 21 coleções normalizadas e alterações locais pendentes separadas.
- Implementado `POST /api/v1/exports` para JSON e ZIP/CSV, sempre derivando o titular da sessão e consultando somente suas entidades. Exercícios globais autorizados são incluídos junto aos personalizados, sem incluir dados personalizados de outro titular.
- O ZIP usa entradas UTF-8, CSVs com BOM, CRLF, neutralização de fórmulas de planilha e `README.txt` com datas, fuso, unidades, relacionamentos e exclusões de segurança.
- A outbox pode ser incluída por escolha explícita; cada item recebe `origin: local_pending` e perde identificador de operação, dispositivo, tentativas, erro e estado interno antes de sair do navegador.
- Chaves de senha, token, segredo, cookie de sessão, dispositivo, operação e hash são rejeitadas recursivamente em payloads pendentes adulterados.
- A tela de conta oferece downloads JSON e CSV/ZIP, explica o conteúdo e informa a retenção de backups antes da exclusão.
- A exclusão reautentica por senha, exige a frase explícita, remove a conta e os dados ativos por cascata, revoga o acesso e anonimiza o identificador residual do evento interno de auditoria.
- A resposta confirmada documenta backups isolados por 7 cópias diárias, 5 semanais e 12 mensais, limitados a 365 dias. Somente depois dessa resposta a aplicação apaga a réplica IndexedDB e a identidade offline.

### Evidências TDD e validação

- RED de contratos — o schema inicial permissivo aceitou metadados de dispositivo/operação e, em um segundo ciclo de segurança, aceitou `sessionToken` dentro do payload; ambos passaram a ser rejeitados pelo contrato estrito.
- RED do pacote — o gerador inicial devolveu arquivo vazio, sem CSVs/BOM/documentação, e não neutralizou fórmula de planilha; a implementação ZIP ficou verde sem nova dependência.
- RED da réplica/UI — a extração da outbox devolvia lista vazia e a tela não expunha portabilidade nem retenção; os testes passaram após a sanitização e o fluxo de download.
- RED de exclusão mínima — o teste PostgreSQL mostrou que o evento interno ainda preservava o UUID do titular; a anonimização após a cascata ficou verde.
- O primeiro ensaio da integração de exportação foi bloqueado pela indisponibilidade do Docker local. O serviço PostgreSQL efêmero previsto no repositório foi iniciado antes da validação; não houve substituição por mock de persistência.
- GREEN final — `pnpm test` passou com 29 arquivos e 87 testes; `pnpm test:integration` passou com 11 arquivos e 46 testes PostgreSQL; `pnpm test:e2e` passou com nove jornadas móveis.
- Gates finais — `pnpm check` passou com governança, verificadores das Fases 1–10, formatação, lint, tipagem, unidades/componentes e builds; `pnpm audit --prod --audit-level moderate` não encontrou vulnerabilidades conhecidas.
- A jornada E2E baixa o JSON, confirma a exclusão e consulta `indexedDB.databases()` para comprovar que a réplica particionada deixou de existir.
- REFACTOR — contratos, consulta autorizada, serialização CSV/ZIP, transporte web, sanitização local e apresentação ficaram em módulos separados; `verify:phase-10` foi incorporado ao gate raiz.

### Alterações técnicas

- Novo endpoint: `POST /api/v1/exports`, com `format: json | csv_zip` e até 5.000 alterações pendentes validadas.
- `DELETE /api/v1/account` passa a devolver confirmação estruturada da remoção ativa e da política de backups.
- O pacote JSON usa nomes estáveis em camelCase; o ZIP mapeia as coleções para arquivos snake_case e guarda estruturas aninhadas como JSON na célula.
- Migrações PostgreSQL: nenhuma; todas as chaves estrangeiras de dados ativos já usavam cascata a partir de `users`.
- Dependências externas: nenhuma; o escritor ZIP armazenado foi implementado com `Buffer`, CRC-32 e estruturas padrão do formato.

### Decisões e ADRs

- Mantidos os ADRs 0001, 0002 e 0003. A portabilidade permanece no monólito modular, a outbox continua no IndexedDB particionado e a reautenticação usa a integração Better Auth existente.
- Operações, change log, dispositivos, auditoria, contas de provedor, hashes e sessões são metadados internos e não fazem parte da exportação. Versões de regras referenciadas por avaliações são incluídas para preservar explicação e relacionamento.
- A limpeza local ocorre depois, e nunca antes, de o servidor confirmar a eliminação dos dados ativos.

### Segurança, privacidade e dados

- Teste com duas contas comprova isolamento horizontal no JSON e em cada CSV do ZIP.
- O pacote não contém senha/hash, conta de provedor, cookie, sessão, token, dispositivo, change log, operação de sync ou auditoria interna.
- Aceites de privacidade são exportados sem hash de IP nem família de user agent; avaliações de progressão não expõem o hash interno da evidência.
- CSVs neutralizam células iniciadas por caracteres de fórmula para reduzir risco ao abrir o pacote em planilhas.
- Após exclusão, sessões, dispositivos e todas as tabelas de domínio ficam vazias para o titular; uma nova tentativa autenticada de exportação recebe `401`.

### Desvios do plano

- Não foi criado um importador de round-trip: o critério desta fase pede round-trip estrutural, comprovado por serialização, parse e validação do mesmo contrato versionado. Importação geral não está no escopo aprovado.
- A exportação completa exige conexão para obter a fonte autoritativa; alterações offline ainda não sincronizadas podem ser anexadas quando o endpoint volta a estar disponível.

### Pendências e riscos conhecidos

- A geração atual monta JSON/ZIP em memória. Históricos muito grandes poderão exigir streaming em uma versão futura do formato, preservando os mesmos limites de autorização.
- A janela máxima de 365 dias descreve a política inicial de 12 backups mensais; uma alteração operacional de retenção deverá atualizar simultaneamente a resposta, a interface e os documentos de privacidade.
- Backups e restauração operacionais serão configurados e exercitados na Fase 12; esta fase implementa e comunica a semântica de exclusão esperada pela aplicação.

### Próximo passo

- Iniciar a Fase 11 com manifesto, app shell offline, atualização segura, instalação multiplataforma e auditoria WCAG 2.2 AA.

## 2026-07-14 — Fase 11: PWA, iOS e acessibilidade

**Status:** concluída por autorização do titular — testes físicos diferidos para a Fase 13

**Commit de encerramento:** `feat(phase-11): harden pwa and mobile experience`

### Escopo executado até aqui

- Configurado `vite-plugin-pwa` com manifesto `pt-BR`, identidade, escopo, modo standalone, cores e ícones reproduzíveis em 192, 512, maskable e Apple touch icon.
- O app shell e os assets de build usam precache versionado; navegações usam Network First, imagens Cache First, fontes Stale While Revalidate e `/api`/`/auth` permanecem Network Only para nunca usar Cache Storage como banco de dados autenticado.
- O service worker é registrado sem `skipWaiting` automático. Uma versão em espera apenas anuncia a atualização e só recebe `SKIP_WAITING` depois da ação explícita do usuário.
- Adicionado fluxo acessível de instalação com prompt nativo quando disponível, instrução específica para Safari/iOS e orientação para Android e desktop, além da versão e do estado standalone instalados.
- Aplicados safe areas, unidades `dvh`, proteção contra zoom involuntário do teclado iOS, alvos mínimos de 44 px, redução de movimento, contraste aumentado e forced colors.
- Adicionados link para pular conteúdo e transferência de foco ao título nas navegações internas.
- Criado checklist separado para iPhone, Android e desktop físicos, sem transformar emulação em evidência de aparelho real.

### Evidências TDD e validação

- RED estrutural — `scripts/verify-phase-11.ps1` enumerou 17 ausências de manifesto, assets, integração PWA, testes e gate antes da configuração.
- RED de componente — os três cenários de instalação, prompt nativo e atualização segura falharam após um módulo mínimo tornar a falha comportamental observável.
- RED de foco — a navegação para a conta manteve foco no `body`; depois da correção o título de destino recebe foco programático.
- RED de regressão E2E — o service worker passou a interceptar uma requisição mockada da jornada analítica; os contextos de UI agora bloqueiam workers e apenas a suíte PWA os habilita, eliminando a corrida sem enfraquecer o teste offline.
- RED de asset maskable — a inspeção visual encontrou cantos brancos fora da área arredondada; o teste de pixel falhou com branco e passou após a geração usar fundo verde full-bleed no ícone maskable.
- RED de data E2E — no dia seguinte à criação da fixture, a jornada Hoje deixou de encontrar a sessão fixa de 14/07/2026; o relógio do navegador passou a ser controlado explicitamente para eliminar dependência da data de execução.
- GREEN automatizado — `pnpm check` passou com 30 arquivos e 91 testes, todos os verificadores até a Fase 11, lint, tipagem, formatação e builds.
- GREEN PostgreSQL — `pnpm test:integration` passou com 11 arquivos e 46 testes contra o serviço efêmero real.
- GREEN E2E — `pnpm test:e2e` passou com 14 jornadas no viewport Pixel 7, incluindo app shell offline, manifesto/service worker, navegação por teclado e duas auditorias Axe sem violação WCAG AA automática.
- `pnpm audit --prod --audit-level moderate` não encontrou vulnerabilidades conhecidas.

### Alterações técnicas

- Nova dependência de build `vite-plugin-pwa@1.3.0` (MIT) e nova dependência de teste `@axe-core/playwright@4.12.1` (MPL-2.0).
- Versão web intermediária `0.11.0`, exposta na experiência instalada e nos nomes de cache.
- Assets PNG são derivados deterministicamente de `torkout-source.svg` por `scripts/generate-pwa-icons.mjs`.
- Migrações PostgreSQL e endpoints: nenhum.

### Segurança, privacidade e dados

- Respostas de API/autenticação usam exclusivamente rede e não são persistidas em Cache Storage.
- Dados de saúde e outbox continuam apenas na réplica IndexedDB particionada; o ciclo do worker não altera nem limpa a réplica.
- O update não recarrega a página sozinho, preservando formulário em andamento e operações pendentes até o usuário decidir atualizar.

### Pendências e riscos conhecidos

- Faltam execuções manuais documentadas em iPhone, Android e desktop físicos, incluindo instalação, standalone, safe areas, teclado, leitor de tela, retomada, Hoje offline e atualização.
- A estação atual não possui `adb`, ferramenta iOS nem aparelho portátil conectado, portanto não há caminho local honesto para produzir essa evidência física.
- O critério obrigatório “Jornada Hoje funciona offline em iPhone físico” ainda não possui evidência e permanece bloqueador de lançamento na Fase 13.
- Em 15/07/2026, o titular autorizou explicitamente encerrar e commitar a Fase 11 para prosseguir à Fase 12, pois não consegue executar o checklist agora. A autorização foi registrada como desvio e não equivale a teste físico aprovado.

### Próximo passo

- Criar o commit de encerramento da Fase 11 e iniciar a Fase 12. Executar e preencher `docs/testing/phase-11-device-checklist.md` antes do lançamento na Fase 13; qualquer achado deve ganhar teste de regressão antes da correção.

## 2026-07-15 — Fase 12: segurança, observabilidade e operação

**Status:** concluída por autorização do titular — validação externa diferida para a Fase 13

**Commit de encerramento:** `chore(phase-12): productionize security and operations`

### Escopo executado até aqui

- Criados threat model, auditoria default-deny dos 42 endpoints protegidos, headers/CSP/HSTS,
  proxy confiável, logs redigidos, métricas Prometheus sem conteúdo pessoal e probes de liveness
  e readiness dependente do PostgreSQL.
- Criadas imagens API/web não root, composição de produção com redes privadas, usuário PostgreSQL
  mínimo e migração one-shot, job de backup S3, composição isolada de restauração e workflow de
  scans de segredo, dependência e imagem.
- Publicados documentos legais versionados em 15/07/2026, com hashes SHA-256 persistidos pela
  migração `0007_phase_12_legal_documents.sql`, além dos runbooks de deploy, rollback, incidente,
  observabilidade, backup, domínio/DNS e SMTP.

### Evidências TDD e validação

- RED estrutural — `verify-phase-12.ps1` enumerou 27 artefatos/controles ausentes antes da
  implementação; o self-test do scanner comprovou detecção de uma credencial controlada.
- RED operacional — headers, readiness e métricas falharam nos testes antes dos hooks e endpoints;
  a auditoria anônima passou depois que os 42 recursos foram enumerados explicitamente.
- RED legal — o teste público rejeitou as versões antigas e a integração PostgreSQL detectou a
  ordem real do enum antes de validar as três versões/hashes ativos e as três versões aposentadas.
- RED de runtime — a imagem web encerrava quando `api` ainda não estava resolvível; o resolver
  Docker passou a ser dinâmico. A primeira resposta raiz perdeu headers herdados; `add_header_inherit
merge` e o teste no container confirmaram CSP e HSTS.
- RED de imagem — o Trivy encontrou 25 vulnerabilidades altas e 2 críticas corrigíveis na
  base web; `apk upgrade` zerou os achados. Na API, npm global e o binário esbuild sem uso em runtime
  expunham 15 altas e 1 crítica; a imagem mínima removeu somente essas ferramentas e zerou o scan.
- GREEN raiz — `pnpm check` passou com 33 arquivos e 138 testes, governança, verificadores das
  Fases 1–12, segredo, formatação, lint, tipagem e builds.
- GREEN PostgreSQL — `pnpm test:integration` passou com 11 arquivos e 47 testes. A primeira chamada
  sem `TEST_DATABASE_URL` foi recusada antes de tocar no banco; a reexecução usou explicitamente o
  banco efêmero terminado em `_test`.
- GREEN E2E — `pnpm test:e2e` passou com 14 jornadas móveis, online/offline e acessibilidade.
- GREEN restauração — 32 tabelas restauradas, RPO aproximado de 0,0003 hora e RTO de 9,99 segundos;
  containers, volume e archive foram removidos ao final.
- GREEN composição — PostgreSQL, migração, API e web ficaram saudáveis localmente; as portas da API
  e do banco não foram publicadas e `torkout_app` foi confirmado sem superuser/createdb/createrole.
- O serviço externo de `pnpm audit` não foi consultado nesta execução porque a política do ambiente
  bloqueou a exportação dos metadados do workspace. Nenhuma dependência npm foi adicionada e o
  Trivy 0.70.0 examinou os pacotes presentes nos artefatos finais sem achar HIGH/CRITICAL
  corrigível. O workflow foi atualizado para a release oficial assinada 0.72.0.

### Pendências e riscos conhecidos

- Falta importar a composição em uma instância Coolify real, configurar domínio/DNS/SMTP, emitir
  certificado, validar HTTPS/cookies/proxy e guardar a evidência do painel.
- Falta provisionar bucket externo e credencial restrita, aplicar lifecycle 7 diários/5 semanais/12
  mensais e executar uma restauração a partir de um backup realmente enviado.
- Esses itens exigem acessos/valores externos que não existem no workspace. A validação local não
  é apresentada como evidência de produção; por autorização explícita, foram transferidos para o
  gate de lançamento da Fase 13 e a Fase 12 foi encerrada no commit `53c638e`.
- A primeira confirmação local adicional com Trivy 0.72.0 concluiu a leitura da API sem listar
  achados, mas o Docker Desktop tornou seu banco interno `meta.db` somente-leitura e não iniciou o
  scan web. A recuperação e a reexecução completa ficaram registradas na Fase 13.
- Em 15/07/2026, o titular autorizou explicitamente commitar a fase e diferir Coolify/HTTPS e o
  backup externo para a Fase 13. A autorização permite continuidade, mas não transforma validação
  local em evidência de produção nem remove esses bloqueadores do lançamento.

### Próximo passo seguro

- Criar `chore(phase-12): productionize security and operations` e iniciar a Fase 13. Antes do
  lançamento, concluir Coolify/HTTPS, bucket/lifecycle/restauração externa, remover o cache Trivy
  preso após reiniciar o Docker e obter todas as evidências físicas diferidas da Fase 11.

## 2026-07-15 — Fase 13: validação integral e lançamento

**Status:** concluída por autorização do titular — validações físicas e externas permanecem bloqueadoras do lançamento

**Commit esperado:** `release(phase-13): validate public launch`

### Escopo executado até aqui

- Versão do monorepo, API, web e pacotes públicos elevada para 1.0.0; cache PWA e teste de manifesto
  passaram a exigir a mesma versão.
- Criados checklist AC-01..AC-12, auditoria da candidata, release notes, checklist de abertura,
  verificador estrutural da fase, freeze SHA-256 de schema/contratos e verificador de rollback.
- A migração aditiva `0008_release_rollback_compatibility.sql` mantém ativas as versões legais
  2026-07-14 e 2026-07-15, permitindo rollback da aplicação 0.11 sem reverter o banco.
- Adicionados testes PostgreSQL de dois dispositivos, conflito real, isolamento entre titulares e
  compatibilidade legal; adicionado E2E de resposta perdida com repetição idempotente e outbox limpa.
- O gate raiz ganhou build explícito dos pacotes internos antes do typecheck, eliminando dependência
  acidental de diretórios `dist` deixados por execuções anteriores.

### Evidências TDD e validação

- RED estrutural — `verify-phase-13.ps1` encontrou nove artefatos ausentes, versões pré-1.0 e a fase
  fora do gate raiz antes da implementação.
- RED de rollback — a imagem anterior não conseguia registrar novos aceites porque a migração 0007
  aposentava as versões legais conhecidas pelo cliente 0.11; a migração 0008 e a integração real
  provaram a correção sem operação destrutiva.
- RED de ambiente limpo — após remover builds gerados durante a falta de espaço, o typecheck não
  resolvia os pacotes internos; o novo `build:packages` tornou `pnpm check` reproduzível.
- RED E2E — o seletor genérico de versão encontrou o selo e o texto explicativo; a asserção passou
  a apontar exatamente para o selo, e a suíte inteira foi repetida.
- GREEN raiz — `pnpm check` passou com 33 arquivos e 138 testes, Fases 1–13, segredo, formatação,
  lint, build dos pacotes, tipagem e builds finais.
- GREEN PostgreSQL — `pnpm test:integration` passou com 12 arquivos e 50 testes no banco efêmero
  terminado em `_test`.
- GREEN E2E — `pnpm test:e2e` passou com 15/15 jornadas, inclusive reconexão após resposta perdida,
  operação offline e app shell/cache PWA 1.0.0.
- GREEN restauração — 32 tabelas restauradas, RPO 0,0003 hora e RTO 6,89 segundos; o ambiente foi
  removido ao final.
- GREEN segurança — as imagens finais API/web foram exportadas e examinadas sem socket Docker pelo
  Trivy oficial 0.72.0; ambas tiveram zero HIGH/CRITICAL corrigível.

### Incidente local e recuperação

- O primeiro Trivy 0.72 coincidiu com esgotamento da unidade C: e deixou o metadata store do Docker
  somente-leitura. A suíte também registrou `ENOSPC`, sem evidência de falha funcional.
- Depois que o titular liberou espaço e autorizou a recuperação, apenas processos/WSL do Docker
  foram reiniciados. Somente o volume/cache Trivy, tarballs e imagens `torkout-*` criados por esta
  validação foram removidos; não houve prune global nem remoção de recursos de outros projetos.
- Com 39 GB livres, todas as suítes e os dois scans foram repetidos com sucesso.

### Pendências e bloqueadores conhecidos

- AC-09 continua bloqueado: faltam instalação, standalone, safe areas, teclado, leitor de tela,
  retomada, Hoje offline e atualização em iPhone, Android e desktop físicos.
- AC-10 continua bloqueado: faltam Coolify/HTTPS/DNS/SMTP reais, bucket externo com lifecycle
  7 diários/5 semanais/12 mensais e restauração a partir do objeto remoto.
- AC-12 passou localmente com Trivy 0.72.0, mas o workflow CI ainda deve ficar verde no SHA candidato.
- Enquanto AC-09/AC-10 estiverem bloqueados, AC-01 permanece pendente; não criar tag `v1.0.0`,
  deploy público ou anúncio de abertura.
- Em 15/07/2026, o titular autorizou explicitamente commitar a fase no estado local validado e
  informou que executará os testes pendentes depois. Esse desvio permite o commit de encerramento,
  mas não transforma pendências em aprovação nem autoriza lançamento.

### Próximo passo seguro

- Obter e registrar as evidências físicas e externas no checklist. Qualquer achado deve receber
  teste de regressão antes da correção; depois, repetir os gates no SHA final, encerrar a Fase 13,
  criar a tag `v1.0.0` e executar o checklist de abertura pública.
