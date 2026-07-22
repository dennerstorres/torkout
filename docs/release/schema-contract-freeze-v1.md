# Freeze de schema e contratos — 2.1.0

- Versão: `2.1.0`
- Cabeça de migração: `0010_phase_20_user_owned_exercises`
- Schema SHA-256: `53018965a1728f42e032f6d65eeb67aee92ae03a85644d6ec433f937c458d611`
- Contracts SHA-256: `5f350047004bf754939ab5ae50c862183d07a0665d1caf68b8a858ef2fd56c48`

O digest de schema cobre SQLs e fontes TypeScript de `packages/database/src/schema`. O digest de
contratos cobre fontes públicas não-teste de `packages/contracts/src`. Execute
`pnpm verify:schema-freeze`; qualquer mudança após o freeze exige nova versão compatível,
migração aditiva quando aplicável e atualização explícita deste documento.

A versão 2.1.0 acrescenta `markdown` aos formatos aceitos pela exportação de portabilidade. A adição
é compatível: os formatos anteriores continuam válidos e nenhum campo foi removido ou renomeado. O
digest ficou defasado desde a entrega do relatório de evolução e foi regularizado na Fase 21, sem
alteração de schema nem de migração.

A versão 2.0.0 remove o catálogo global de exercícios, o campo público `isSystem` e a constante
`SYSTEM_EXERCISES`. A migração cria exercícios iniciais por titular, preserva referências existentes
e torna `exercises.user_id` obrigatório. A quebra foi aceita antes do uso em produção.

Durante a janela de rollback 1.0, documentos legais 2026-07-14 e 2026-07-15 permanecem ativos. A
aposentadoria das versões anteriores exige migração futura somente depois de encerrar suporte à
imagem 0.11.
