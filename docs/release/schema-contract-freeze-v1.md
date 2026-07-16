# Freeze de schema e contratos — 1.1.0

- Versão: `1.1.0`
- Cabeça de migração: `0009_phase_16_planning_measurements`
- Schema SHA-256: `564266cca8534dd105e7d44c5681604a639013d2f3d532fca22e98025f14ddba`
- Contracts SHA-256: `dc85f622501cff950eaccdcf3ed308c286983a2761c4a58b951214c18a8aee60`

O digest de schema cobre SQLs e fontes TypeScript de `packages/database/src/schema`. O digest de
contratos cobre fontes públicas não-teste de `packages/contracts/src`. Execute
`pnpm verify:schema-freeze`; qualquer mudança após o freeze exige nova versão compatível,
migração aditiva quando aplicável e atualização explícita deste documento.

Durante a janela de rollback 1.0, documentos legais 2026-07-14 e 2026-07-15 permanecem ativos. A
aposentadoria das versões anteriores exige migração futura somente depois de encerrar suporte à
imagem 0.11.
