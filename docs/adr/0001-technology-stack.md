# ADR-0001 — Stack tecnológica

**Status:** Accepted

**Data:** 2026-07-14

**Responsáveis:** projeto Torkout

## Contexto

O Torkout precisa oferecer uma PWA mobile-first, API versionada, PostgreSQL, autenticação segura, sincronização offline personalizada, regras de progressão explicáveis e implantação no Coolify. O titular já possui servidor e prefere controle sobre os dados.

A escolha precisa manter o desenvolvimento produtivo sem introduzir uma plataforma maior que o produto. O domínio inclui regras e sincronização que não são adequadamente resolvidas por CRUD direto do navegador para o banco.

## Decisão

Adotar monorepo TypeScript com:

- React, Vite e TypeScript no frontend.
- Fastify e Node.js LTS na API.
- Zod para contratos compartilhados.
- PostgreSQL como banco autoritativo.
- Drizzle ORM e migrações SQL versionadas.
- Better Auth para autenticação.
- Dexie/IndexedDB para réplica local.
- Workbox por meio de `vite-plugin-pwa` para app shell.
- `pnpm` como gerenciador do workspace.
- Docker e Coolify para implantação.

A aplicação começa como monólito modular. Frontend, API e banco podem ser containers separados, mas pertencem ao mesmo sistema e ciclo de release.

## Consequências positivas

- Controle integral do banco e da API.
- Regras de negócio centralizadas e testáveis.
- Contratos tipados entre frontend e backend.
- Migrações explícitas e revisáveis.
- Menor acoplamento a fornecedor gerenciado.
- Infraestrutura compatível com o servidor existente.

## Consequências negativas e riscos

- O projeto assume atualização, hardening, monitoramento, backup e restauração.
- Autenticação e e-mail exigem configuração operacional.
- A API própria demanda mais trabalho inicial que CRUD gerado.
- A equipe precisa evitar duplicar validações ou modelos divergentes.

## Alternativas consideradas

### Supabase gerenciado

Oferece PostgreSQL, Auth, RLS e API rapidamente, mas não resolve a réplica offline, outbox e conflitos. Acesso direto às tabelas também dispersaria regras entre cliente, RLS e funções. Não foi escolhido pela preferência de controle e pela necessidade de API de domínio explícita.

### Supabase auto-hospedado

Manteria controle dos dados, porém adicionaria vários serviços e responsabilidades operacionais sem eliminar manutenção de backup, segurança e recuperação. Foi considerado excessivo para o sistema.

### Express

É simples e conhecido, mas Fastify oferece validação, serialização, logging e estrutura de plugins mais alinhados à API contratual.

### Prisma ou Sequelize

São alternativas válidas. Drizzle foi escolhido pela proximidade com SQL, tipagem, baixo peso e migrações inspecionáveis.

## Verificação

- Nenhum acesso direto do frontend ao PostgreSQL.
- API de produto sob `/api/v1`.
- Contratos compartilhados e validados nos dois lados.
- Ausência de microsserviços sem ADR posterior.
- Migrações SQL presentes para alterações de schema.

## Referências

- [Especificação](../../SPEC.md)
- [Plano](../../PLAN.md)
- [ADR-0002](0002-local-first-synchronization.md)
- [ADR-0003](0003-authentication.md)
