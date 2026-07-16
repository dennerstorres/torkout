# Freeze de schema e contratos — 2.0.0

- Versão: `2.0.0`
- Cabeça de migração: `0010_phase_20_user_owned_exercises`
- Schema SHA-256: `53018965a1728f42e032f6d65eeb67aee92ae03a85644d6ec433f937c458d611`
- Contracts SHA-256: `b673293e72e23eb54b84bb9b76029f38fef96491582fb1d53e7d2a97f2cc8c8f`

O digest de schema cobre SQLs e fontes TypeScript de `packages/database/src/schema`. O digest de
contratos cobre fontes públicas não-teste de `packages/contracts/src`. Execute
`pnpm verify:schema-freeze`; qualquer mudança após o freeze exige nova versão compatível,
migração aditiva quando aplicável e atualização explícita deste documento.

A versão 2.0.0 remove o catálogo global de exercícios, o campo público `isSystem` e a constante
`SYSTEM_EXERCISES`. A migração cria exercícios iniciais por titular, preserva referências existentes
e torna `exercises.user_id` obrigatório. A quebra foi aceita antes do uso em produção.

Durante a janela de rollback 1.0, documentos legais 2026-07-14 e 2026-07-15 permanecem ativos. A
aposentadoria das versões anteriores exige migração futura somente depois de encerrar suporte à
imagem 0.11.
