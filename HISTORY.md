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
