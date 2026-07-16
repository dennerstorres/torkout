# Freeze de schema e contratos — 1.2.0

- Versão: `1.2.0`
- Cabeça de migração: `0009_phase_16_planning_measurements`
- Schema SHA-256: `564266cca8534dd105e7d44c5681604a639013d2f3d532fca22e98025f14ddba`
- Contracts SHA-256: `21fde425f7544ff90071c37d8ff40d19bcff38ae0ef35ab67e01364d3ee341fb`

O digest de schema cobre SQLs e fontes TypeScript de `packages/database/src/schema`. O digest de
contratos cobre fontes públicas não-teste de `packages/contracts/src`. Execute
`pnpm verify:schema-freeze`; qualquer mudança após o freeze exige nova versão compatível,
migração aditiva quando aplicável e atualização explícita deste documento.

A versão 1.2.0 amplia de forma compatível a atualização de sessões para aceitar nome, tipo e
composição completos de sessões avulsas ainda planejadas. O schema de banco não mudou.

Durante a janela de rollback 1.0, documentos legais 2026-07-14 e 2026-07-15 permanecem ativos. A
aposentadoria das versões anteriores exige migração futura somente depois de encerrar suporte à
imagem 0.11.
