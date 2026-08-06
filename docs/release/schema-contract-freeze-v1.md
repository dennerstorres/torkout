# Freeze de schema e contratos — 2.4.0

- Versão: `2.4.0`
- Cabeça de migração: `0013_phase_30_mcp_oauth`
- Schema SHA-256: `40708e6c0e158447e769679f4df529d3b02f6e86aa4728c4c945459b73bf5a84`
- Contracts SHA-256: `bebd02ba4f9aeef1a39caf952f3b117305e34fc3628e183926c828accae0c93f`

O digest de schema cobre SQLs e fontes TypeScript de `packages/database/src/schema`. O digest de
contratos cobre fontes públicas não-teste de `packages/contracts/src`. Execute
`pnpm verify:schema-freeze`; qualquer mudança após o freeze exige nova versão compatível,
migração aditiva quando aplicável e atualização explícita deste documento.

A versão 2.4.0 acrescenta a integração MCP somente leitura. A migração `0013_phase_30_mcp_oauth` é
aditiva: cria `mcp_oauth_clients`, `mcp_authorization_codes`, `mcp_tokens` e `mcp_consents`, que
guardam apenas credenciais em hash e não participam da sincronização nem da exportação. Nenhuma
tabela existente foi alterada e nenhum campo público foi removido ou renomeado. Em contratos, o
módulo `mcp.ts` é inteiramente novo; os schemas anteriores continuam válidos.

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
