# Auditoria de autorização da API

**Revisão:** 2026-07-15

## Política

- Exceções públicas: `/health/live`, `/health/ready`, `/metrics`, `/auth/*` e leitura dos documentos públicos.
- Todas as demais rotas exigem sessão verificada; mutações também exigem `Origin` confiável.
- O identificador do titular sempre vem da sessão, nunca do payload/query.
- A rota administrativa exige `role=admin` e não devolve conteúdo de saúde.

## Cobertura

| Grupo                 | Rotas                                         | Sessão                  | Isolamento horizontal                                            |
| --------------------- | --------------------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| Perfil/privacidade    | profile, acceptances                          | `authorization.test.ts` | `account.integration.test.ts`                                    |
| Planejamento          | exercises, plans, templates, sessions         | `authorization.test.ts` | `planning.integration.test.ts`                                   |
| Diário                | execution, pain, habits, measurements, import | `authorization.test.ts` | `daily.integration.test.ts`                                      |
| Histórico/indicadores | history, progress                             | `authorization.test.ts` | `history.integration.test.ts`, `analytics.integration.test.ts`   |
| Progressão            | evaluate, suggestions, decisions              | `authorization.test.ts` | `progression.integration.test.ts`                                |
| Sync                  | push, pull                                    | `authorization.test.ts` | `sync.integration.test.ts`                                       |
| Portabilidade/conta   | exports, delete account                       | `authorization.test.ts` | `portability.integration.test.ts`, `account.integration.test.ts` |
| Administração         | block user                                    | `authorization.test.ts` | teste de papel administrativo existente na integração de conta   |

O teste unitário enumera cada método/rota registrada e exige `401` antes de validação ou banco. Os
testes PostgreSQL usam dois titulares e comprovam que consultas/mutações filtram `user_id`. Nova
rota de produto exige entrada nas duas camadas antes do merge.
