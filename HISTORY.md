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
