# Runbook de rollback

1. Interromper promoção e registrar commit/imagem, horário e sintomas sem conteúdo pessoal.
2. Se apenas web/API mudou, redirecionar Coolify à imagem anterior conhecida como saudável.
3. Não reverter migração destrutiva. Aplicar forward fix compatível com as duas versões.
4. Confirmar readiness, liveness, autenticação, sync idempotente e jornada Hoje.
5. Se integridade estiver incerta, colocar aplicação em manutenção e preservar banco/outbox.
6. Abrir incidente, comunicar impacto e anexar request IDs técnicos.

Rollback é concluído somente com probes verdes e ausência de crescimento de 5xx. Se o problema
envolver perda/corrupção, seguir `backup-restore.md` em ambiente isolado antes de qualquer ação no
banco autoritativo.
