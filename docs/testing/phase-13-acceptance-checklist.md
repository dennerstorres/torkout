# Checklist executável de aceite — Fase 13

Fonte: seção 17 do `SPEC.md`. Estados permitidos: `PASSOU`, `BLOQUEADO` ou `PENDENTE`.
O comando `pnpm verify:phase-13` comprova que os 12 critérios continuam mapeados; evidência manual
deve informar data, ambiente e responsável, sem marcar emulação como aparelho físico.

| ID    | Estado    | Critério e evidência                                                                                         |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------ |
| AC-01 | PENDENTE  | Fases registradas; a própria Fase 13 só passa quando todos os bloqueadores abaixo forem encerrados.          |
| AC-02 | PASSOU    | Auth, recuperação e exclusão: `auth.integration.test.ts`, `account.integration.test.ts` e E2E.               |
| AC-03 | PASSOU    | Isolamento entre titulares: integrações de todos os recursos e `release.integration.test.ts`.                |
| AC-04 | PASSOU    | Jornadas online/offline: unidades web e E2E de planejamento, Hoje, histórico e indicadores.                  |
| AC-05 | PASSOU    | Repetição/resposta perdida: integração de sync, unidade do coordenador e `reconnection.spec.ts`.             |
| AC-06 | PASSOU    | Conflito explícito entre dois dispositivos: `release.integration.test.ts` e componentes de resolução.        |
| AC-07 | PASSOU    | Progressão explicável/opcional/versionada: contratos, domínio, integração e E2E de progressão.               |
| AC-08 | PASSOU    | JSON e CSV ZIP: contratos, serialização, isolamento, round-trip e E2E de portabilidade.                      |
| AC-09 | PASSOU    | Instalação/teste físico em iPhone, Android e desktop confirmados pelo titular em 16/07/2026.                 |
| AC-10 | BLOQUEADO | Backup externo/restauração real: ensaio local passou, mas bucket/lifecycle/Coolify ainda não foram providos. |
| AC-11 | PASSOU    | Threat model, aviso de privacidade e incidente estão versionados em `docs/`.                                 |
| AC-12 | PASSOU    | Trivy oficial 0.72.0: imagens finais API e web com zero HIGH/CRITICAL corrigível em 15/07/2026.              |

## Comandos de evidência automatizada

1. `pnpm check`
2. `pnpm test:integration` com `TEST_DATABASE_URL` dedicado terminado em `_test`
3. `pnpm test:e2e`
4. `pnpm test:restore`
5. Build das duas imagens e scan HIGH/CRITICAL fixado no workflow de segurança

Não executar release/tag se houver qualquer `BLOQUEADO` ou `PENDENTE` nesta tabela.
