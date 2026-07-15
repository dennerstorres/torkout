# Backup e restauração

## Política

- Backup PostgreSQL diário externo, formato custom, checksum SHA-256, TLS e SSE no bucket.
- Retenção por lifecycle imutável: 7 diários, 5 semanais e 12 mensais.
- Credencial do job limitada ao prefixo de backup; API não recebe credencial do bucket.
- Alerta quando o último backup ultrapassar 26 horas ou upload/checksum falhar.
- Backup extraordinário antes de migração destrutiva.

## Restauração

1. Criar PostgreSQL isolado sem rota pública.
2. Baixar archive/checksum, validar SHA-256 e nunca restaurar diretamente sobre produção.
3. Executar `pg_restore --no-owner --no-acl` com credencial temporária.
4. Validar migrações, quantidade de tabelas, probe, autorização e amostra sintética.
5. Medir idade do ponto restaurado (RPO ≤ 24 h) e tempo total (RTO ≤ 4 h).
6. Destruir ambiente/credencial temporários e registrar somente métricas/evidência técnica.

## Exercício local da Fase 12

Executar `pnpm test:restore`. O script cria origem/alvo PostgreSQL efêmeros, aplica todas as
migrações, grava probe sintético, realiza `pg_dump`/`pg_restore`, valida pelo menos 20 tabelas,
mede RPO/RTO e remove containers/archive em `finally`.

**Último resultado:** aprovado em 15/07/2026. Foram restauradas 32 tabelas em ambiente
isolado, com RPO aproximado de 0,0003 hora e RTO de 9,99 segundos. O script removeu os dois
bancos efêmeros e o archive ao concluir.
