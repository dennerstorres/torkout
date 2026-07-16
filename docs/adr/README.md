# Registros de Decisão Arquitetural

Esta pasta registra decisões arquiteturais relevantes do Torkout. ADRs explicam contexto, decisão, consequências e alternativas; não substituem os requisitos do `SPEC.md`.

## Estados

- **Proposed:** em discussão.
- **Accepted:** vigente.
- **Deprecated:** ainda existe, mas não deve ser expandida.
- **Superseded:** substituída por outro ADR.
- **Rejected:** considerada e não adotada.

## Regras

1. Usar numeração sequencial com quatro dígitos.
2. Copiar o [template](template.md).
3. Não reescrever uma decisão aceita para mudar seu significado.
4. Criar novo ADR e marcar o anterior como substituído.
5. Referenciar ADRs relacionados e requisitos afetados.
6. Registrar a adoção no `HISTORY.md` da fase.

## Índice

- [ADR-0001 — Stack tecnológica](0001-technology-stack.md)
- [ADR-0002 — Sincronização local-first](0002-local-first-synchronization.md)
- [ADR-0003 — Autenticação e autorização](0003-authentication.md)
- [ADR-0004 — Exercícios iniciais pertencentes à conta](0004-user-owned-initial-exercises.md)
