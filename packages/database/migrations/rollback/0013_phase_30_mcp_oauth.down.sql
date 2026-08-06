-- Reversão da migração 0013_phase_30_mcp_oauth.
--
-- Execute manualmente, em transação única, apenas quando for necessário voltar ao schema anterior.
-- A migração é aditiva: nenhuma tabela existente foi alterada e nenhum dado de treino, medida,
-- alimentação ou recuperação depende destas tabelas.
--
-- Ao reverter, todo cliente MCP registrado, todo consentimento concedido e todo token emitido são
-- descartados. Nenhum dado do titular é perdido; apenas o acesso externo deixa de existir e cada
-- cliente precisará ser autorizado de novo depois de reaplicar a migração.

BEGIN;

DROP TABLE IF EXISTS "mcp_tokens";
DROP TABLE IF EXISTS "mcp_consents";
DROP TABLE IF EXISTS "mcp_authorization_codes";
DROP TABLE IF EXISTS "mcp_oauth_clients";
DROP TYPE IF EXISTS "public"."mcp_token_kind";

COMMIT;
