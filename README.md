# Torkout

Aplicativo web progressivo (PWA) para planejar, registrar e acompanhar treinos, caminhadas, medidas
corporais, hábitos alimentares e ocorrências de dor — com registro rápido no celular, funcionamento
offline e sincronização posterior.

**Instância de produção:** <https://torkout.dennerstorres.dev>

> **Projeto pessoal.** Construí o Torkout para o meu próprio acompanhamento de treino. A instância
> acima é minha e é de uso pessoal — não é um serviço aberto a cadastros. O código está público
> para quem quiser ler, aprender ou hospedar a própria cópia.

> **Não é software médico.** O Torkout registra e resume o que você informa. Ele não diagnostica,
> não prescreve e não substitui orientação médica, fisioterapêutica, nutricional ou de educação
> física. Sugestões de progressão são conservadoras, explicáveis e nunca aplicadas sem aceite
> explícito.

A interface da aplicação é inteiramente em português do Brasil (`pt-BR`), assim como a documentação
técnica deste repositório.

## O que ele faz

- **Planejamento recorrente** — planos, templates de força/caminhada/descanso, associação a dias da
  semana e horários locais. Alterar o plano futuro nunca reescreve treino já registrado.
- **Tela Hoje** — a entrada do app: sessões do dia, metas por série, registro de repetições,
  duração ou distância, hábitos, peso e cintura. Cada edição grava localmente sem exigir que a
  sessão seja concluída.
- **Execução e histórico** — estados explícitos (`planned`, `in_progress`, `completed`, `partial`,
  `missed`, `cancelled`), lançamento retroativo marcado de forma permanente e snapshot histórico
  preservado por sessão.
- **Dor e recuperação** — tipo, intensidade qualitativa e 0–10, momento, região, inchaço e
  dificuldade de apoio. Ausência de registro nunca é tratada como ausência de dor.
- **Hábitos e medidas** — café, arroz, proteína, salada, whey, hábitos personalizados, peso,
  cintura e demais circunferências.
- **Indicadores** — aderência, volume por treino, recordes de série e variação das medidas.
- **Local-first** — o app escreve primeiro no IndexedDB e sincroniza depois, com outbox durável,
  versão explícita por entidade e resolução de conflito apresentada ao usuário, sem
  last-write-wins silencioso.
- **Privacidade** — cada usuário só enxerga os próprios dados, a réplica local é particionada por
  conta e há exportação (JSON/CSV) e exclusão completa da conta.

## Stack

| Camada   | Tecnologias                                                                        |
| -------- | ---------------------------------------------------------------------------------- |
| Frontend | React 19, Vite, TypeScript estrito, Dexie/IndexedDB, TanStack Query, Recharts, PWA |
| Backend  | Node.js 22+, Fastify, Zod + OpenAPI, Drizzle ORM, Better Auth, Argon2id, Pino      |
| Banco    | PostgreSQL 18, migrações SQL geradas e versionadas                                 |
| Infra    | Docker, Coolify, backups compatíveis com S3                                        |
| Testes   | Vitest (unit/integração), Playwright + axe-core (E2E e acessibilidade)             |

## Estrutura

```text
apps/
  api/            API Fastify sob /api/v1
  web/            PWA React
packages/
  contracts/      contratos Zod compartilhados entre web e API
  domain/         regras de domínio puras (sem React, Fastify ou ORM)
  database/       schema Drizzle e migrações
  test-utils/     utilitários de teste
docs/             ADRs, operação, segurança, legal, testes e guia do usuário
infra/            Postgres e backup
e2e/              testes Playwright
scripts/          verificações de fase, segurança e ambiente
```

O frontend nunca acessa o PostgreSQL diretamente, e as regras de domínio não dependem de framework.

## Rodando localmente

**Requisitos:** Node.js `>=22.12 <25`, `pnpm@11.1.2`, Docker (Postgres e Mailpit) e PowerShell
(`powershell.exe` no Windows, `pwsh` no Linux/macOS — os scripts de ambiente são `.ps1`).

```bash
pnpm install
pnpm dev
```

`pnpm dev` cria o `.env` a partir de `.env.example` se ainda não existir, sobe os containers de
desenvolvimento, compila os pacotes internos, aplica as migrações e inicia API e web em paralelo.

| Serviço           | URL                     |
| ----------------- | ----------------------- |
| Web               | <http://localhost:5173> |
| API               | <http://localhost:3000> |
| Mailpit (e-mails) | <http://localhost:8025> |
| PostgreSQL        | `localhost:55433`       |

Para derrubar os containers: `pnpm dev:down`.

Os valores de `.env.example` servem apenas para desenvolvimento local. Nenhum deles deve ser
reaproveitado em ambiente exposto — em especial `AUTH_SECRET` e as credenciais do banco.

## Testes e qualidade

```bash
pnpm format:check     # formatação
pnpm lint             # ESLint, zero warnings
pnpm typecheck        # TypeScript em todos os pacotes
pnpm test             # unitários (Node e web)
pnpm test:integration # integração contra PostgreSQL real
pnpm test:e2e         # Playwright, incluindo acessibilidade
pnpm build            # build de todos os pacotes e apps
```

`pnpm check` roda a bateria completa, incluindo as verificações de governança e de fase.

O repositório segue TDD obrigatório (Red → Green → Refactor) e as demais regras descritas em
[`CLAUDE.md`](CLAUDE.md).

## Documentação

| Documento                                            | Conteúdo                                         |
| ---------------------------------------------------- | ------------------------------------------------ |
| [`SPEC.md`](SPEC.md)                                 | especificação do produto e da arquitetura        |
| [`PLAN.md`](PLAN.md)                                 | fases, tarefas e critérios de saída              |
| [`HISTORY.md`](HISTORY.md)                           | o que foi efetivamente entregue em cada fase     |
| [`DESIGN.md`](DESIGN.md)                             | sistema visual e regras de ritmo/espaçamento     |
| [`CLAUDE.md`](CLAUDE.md)                             | regras de engenharia obrigatórias                |
| [`docs/GUIA_DO_USUARIO.md`](docs/GUIA_DO_USUARIO.md) | guia de uso da aplicação                         |
| [`docs/adr/`](docs/adr/README.md)                    | decisões arquiteturais                           |
| [`docs/operations/`](docs/operations/)               | deploy, backup/restauração, rollback, incidentes |
| [`docs/security/`](docs/security/)                   | threat model e auditoria de autorização          |
| [`docs/legal/`](docs/legal/)                         | aviso de privacidade e termos de uso             |

## Auto-hospedagem

O Torkout foi feito para rodar na própria infraestrutura de quem o usa. `compose.production.yml`,
os manifestos em `infra/` e os runbooks em [`docs/operations/`](docs/operations/) cobrem o caminho
que uso: Coolify, PostgreSQL em rede privada, HTTPS obrigatório e backup externo compatível com S3.

Se você hospedar uma instância e ela receber dados de outras pessoas, os dados de treino, dor e
medidas são dados de saúde: a responsabilidade por eles passa a ser sua, incluindo os documentos
legais em [`docs/legal/`](docs/legal/), que precisam ser adaptados ao seu contexto.

## Contribuindo

Contribuições são bem-vindas dentro do escopo do [`SPEC.md`](SPEC.md). Leia
[`CONTRIBUTING.md`](CONTRIBUTING.md) antes de abrir um PR — o projeto tem processo de TDD e de
encerramento de fase que o código precisa respeitar.

Vulnerabilidades não devem ser abertas como issue pública; veja [`SECURITY.md`](SECURITY.md).

## Licença

[MIT](LICENSE) © Denner Torres
