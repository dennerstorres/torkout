-- Reversão da migração 0014_phase_32_optional_pkce.
--
-- Execute manualmente, em transação única, apenas quando for necessário voltar ao schema anterior.
-- A migração original apenas afrouxou a obrigatoriedade de duas colunas; nenhum dado de treino,
-- medida, alimentação ou recuperação depende delas.
--
-- Voltar a NOT NULL exige que nenhuma linha tenha desafio nulo. Códigos de autorização vivem 60
-- segundos, então o descarte abaixo é seguro: no pior caso, um cliente em pleno fluxo precisa
-- refazer a autorização. Reverter o schema sem reverter a aplicação faz todo cliente confidencial
-- sem PKCE — o GPT Actions — parar de conseguir autorizar.

begin;

delete from mcp_authorization_codes
where code_challenge is null or code_challenge_method is null;

alter table mcp_authorization_codes alter column code_challenge set not null;
alter table mcp_authorization_codes alter column code_challenge_method set not null;

commit;
