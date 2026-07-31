-- Reversão da migração 0012_phase_23_retroactive_logging.
--
-- Execute manualmente, em transação única, apenas quando for necessário voltar ao schema anterior.
-- A migração é aditiva: a coluna é nula por padrão e nenhum registro anterior foi alterado.
--
-- Ao reverter, perde-se a distinção entre execução registrada no dia e execução lançada depois.
-- As sessões permanecem intactas; apenas a marca de retroatividade desaparece, e o relatório volta
-- a apresentar toda conclusão como se tivesse sido registrada na própria data. Exporte antes com
-- `POST /api/v1/exports` se essa distinção precisar ser preservada fora do banco.

BEGIN;

ALTER TABLE "workout_sessions" DROP COLUMN IF EXISTS "retroactively_logged_at";

COMMIT;
