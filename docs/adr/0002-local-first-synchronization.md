# ADR-0002 — Sincronização local-first

**Status:** Accepted

**Data:** 2026-07-14

**Responsáveis:** projeto Torkout

## Contexto

O registro de treino precisa funcionar com internet instável e no iOS. Service workers permitem cache do app shell, mas execução confiável em segundo plano não pode ser pressuposta. O usuário precisa receber confirmação imediata ao registrar uma série, sem esperar a rede.

O sistema também permite múltiplos aparelhos. Isso exige idempotência, concorrência otimista, tombstones e resolução explícita de conflitos.

## Decisão

Adotar arquitetura local-first com servidor autoritativo após sincronização:

- IndexedDB, por meio de Dexie, guarda a réplica local de cada usuário.
- Toda mutação atualiza o dado e cria operação de outbox na mesma transação local.
- IDs de entidades e operações são UUIDs criados no cliente.
- `/api/v1/sync/push` recebe lotes e responde por operação.
- Operações são idempotentes por usuário e `operationId`.
- Cada registro sincronizável possui `version` monotônica.
- Atualizações enviam `baseVersion`; versão obsoleta gera conflito.
- `/api/v1/sync/pull` usa cursor opaco sobre change log.
- Exclusões são tombstones retidos inicialmente por 90 dias.
- Conflitos no mesmo campo exigem decisão do usuário.
- Sincronização ocorre ao abrir, retomar, recuperar rede, salvar online e por ação manual.
- Background Sync pode ser otimização futura, nunca requisito de integridade.

Cache Storage guarda somente app shell e recursos adequados. Dados autenticados de saúde permanecem no IndexedDB e no PostgreSQL.

## Consequências positivas

- Registro percebido como imediato.
- Trabalho offline sobrevive a reload.
- Repetição após queda não duplica dados.
- O usuário vê pendências e conflitos.
- A estratégia funciona sem depender de suporte uniforme a background sync.

## Consequências negativas e riscos

- Sincronização é uma parte complexa do domínio.
- Tombstones e change log exigem retenção e limpeza cuidadosas.
- Dados locais podem ficar obsoletos.
- Conflitos entre aparelhos exigem interface específica.
- IndexedDB não substitui backup do servidor e pode ser removido pelo navegador/sistema.

## Alternativas consideradas

### Cache HTTP e TanStack Query somente

Não oferecem uma outbox transacional durável nem modelo completo de conflitos.

### Last-write-wins

É simples, mas pode apagar séries, observações ou dores registradas em outro aparelho sem aviso.

### CRDT

Resolveria algumas formas de concorrência, mas adicionaria complexidade desproporcional. O modelo majoritariamente append-only e a resolução otimista são suficientes inicialmente.

### Depender de Background Sync

Não possui suporte confiável em todas as plataformas alvo, especialmente no fluxo esperado para iOS.

## Verificação

- Testes de reload offline preservam dado e outbox.
- Repetir a mesma operação não duplica registro.
- Queda após commit do servidor é recuperável.
- Versão obsoleta retorna conflito.
- Tombstone não ressuscita após pull.
- Usuários no mesmo navegador não compartilham réplica lógica.

## Referências

- [Especificação de sincronização](../../SPEC.md#713-offline-e-sincronização)
- [Plano da Fase 4](../../PLAN.md#fase-4--fundação-de-sincronização-local-first)
- [ADR-0001](0001-technology-stack.md)
