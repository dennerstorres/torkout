# Freeze de schema e contratos — 1.0.0

- Versão: `1.0.0`
- Cabeça de migração: `0008_release_rollback_compatibility`
- Schema SHA-256: `e695a94fce04b0fe2a6b4084253a8bfcc75d5e0105d9431e5d6057eff640e77a`
- Contracts SHA-256: `b69d77c22d8df25446aa2a166e969024373d4465acf92bf4b74a2da807351736`

O digest de schema cobre SQLs e fontes TypeScript de `packages/database/src/schema`. O digest de
contratos cobre fontes públicas não-teste de `packages/contracts/src`. Execute
`pnpm verify:schema-freeze`; qualquer mudança após o freeze exige nova versão compatível,
migração aditiva quando aplicável e atualização explícita deste documento.

Durante a janela de rollback 1.0, documentos legais 2026-07-14 e 2026-07-15 permanecem ativos. A
aposentadoria das versões anteriores exige migração futura somente depois de encerrar suporte à
imagem 0.11.
