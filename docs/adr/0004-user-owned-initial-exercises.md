# ADR-0004 — Exercícios iniciais pertencentes à conta

**Status:** Accepted

**Data:** 2026-07-16

**Responsáveis:** projeto Torkout

## Contexto

Flexão, agachamento livre e caminhada foram modelados como um catálogo global somente leitura.
Isso impede que cada pessoa adapte, desative ou exclua esses itens e cria dois caminhos de
autorização para a mesma entidade. A aplicação ainda não está em produção, portanto a remoção
desse conceito não precisa manter compatibilidade pública com clientes anteriores.

## Decisão

Todo exercício terá um titular obrigatório. Ao criar uma conta, o banco inserirá flexão,
agachamento livre e caminhada como linhas normais desse titular e registrará as mudanças para o
pull local-first. A migração copiará os itens globais para contas existentes, trocará referências
ativas e históricas para as cópias correspondentes e removerá `is_system`.

## Consequências positivas

- Um único modelo de CRUD e autorização atende todos os exercícios.
- Cada conta pode personalizar os itens iniciais sem afetar outras contas.
- O frontend deixa de embutir IDs e nomes de um catálogo global.

## Consequências negativas e riscos

- Os valores do seed existem em SQL e precisam ser alterados por nova migração quando evoluírem.
- A migração precisa preservar referências por titular antes de apagar as linhas globais.

## Alternativas consideradas

### Manter o catálogo global e permitir sobrescritas

Exigiria uma segunda entidade ou sobreposições por conta, mantendo regras especiais e aumentando a
complexidade de sync sem benefício nesta fase.

### Semear somente no navegador

Poderia duplicar registros em aparelhos diferentes e deixaria o PostgreSQL sem uma origem única e
atômica para o cadastro inicial.

## Verificação

Testes de migração confirmam titularidade obrigatória, seed no cadastro, change log e preservação
de referências. Testes de API, sync e componente confirmam isolamento e CRUD completo.

## Referências

- `SPEC.md`: EXERCISE-001, EXERCISE-004 e EXERCISE-006.
- `docs/adr/0002-local-first-synchronization.md`.
