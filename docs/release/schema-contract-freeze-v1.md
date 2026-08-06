# Freeze de schema e contratos — 2.5.0

- Versão: `2.5.0`
- Cabeça de migração: `0014_phase_32_optional_pkce`
- Schema SHA-256: `13c5c10f906f3090415a7e768f29db5fc118f78937793146b149ed23e05840e2`
- Contracts SHA-256: `bebd02ba4f9aeef1a39caf952f3b117305e34fc3628e183926c828accae0c93f`

O digest de schema cobre SQLs e fontes TypeScript de `packages/database/src/schema`. O digest de
contratos cobre fontes públicas não-teste de `packages/contracts/src`. Execute
`pnpm verify:schema-freeze`; qualquer mudança após o freeze exige nova versão compatível,
migração aditiva quando aplicável e atualização explícita deste documento.

A versão 2.5.0 torna `mcp_authorization_codes.code_challenge` e `code_challenge_method` opcionais,
pela migração `0014_phase_32_optional_pkce`. A alteração é aditiva no sentido que importa: afrouxa
uma restrição em vez de apertá-la, não toca em dado existente e não altera nenhum contrato público —
o digest de contratos permanece o mesmo. Nenhuma linha guardada deixa de ser válida. A motivação, os
riscos aceitos e a consulta que verifica a invariante estão no
[ADR-0006](../adr/0006-pkce-optional-for-confidential-clients.md). A reversão está em
`packages/database/migrations/rollback/0014_phase_32_optional_pkce.down.sql` e exige descartar
códigos sem desafio, que vivem 60 segundos.

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
