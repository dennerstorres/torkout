# Observabilidade e alertas

## Sinais expostos

- Logs JSON: request ID, método, caminho sem query, status, duração e tipo estável de erro.
- Nunca registrar body, Authorization, cookie, `set-cookie`, senha, token, notas, dor ou medidas.
- `/metrics`: contagem e duração HTTP por método, template de rota e classe de status.
- `/health/live`: processo ativo, sem dependências.
- `/health/ready`: consulta mínima ao PostgreSQL; `503` sem detalhes quando indisponível.

`/metrics` fica apenas na rede privada do monitor. O proxy público não deve publicar essa rota em
produção; no compose ela é alcançável pelo coletor na rede `backend`.

## Alertas iniciais

| Alerta             | Janela/limite                | Ação                                          |
| ------------------ | ---------------------------- | --------------------------------------------- |
| indisponibilidade  | 2 probes seguidos ou 2 min   | runbook de incidente                          |
| readiness falhando | 3 probes/5 min               | verificar PostgreSQL/rede/migração            |
| HTTP 5xx           | > 2% por 5 min               | correlacionar request ID, rollback se release |
| p95 comum          | > 500 ms por 10 min          | examinar rota/DB sem payload                  |
| autenticação 429   | aumento > 3× baseline        | avaliar abuso sem coletar e-mail/senha        |
| falha de sync      | 5xx em `/api/v1/sync/*` > 1% | preservar outbox e investigar API             |
| backup atrasado    | último objeto > 26 h         | executar backup e validar bucket              |
| restauração        | exercício trimestral ausente | bloquear release operacional                  |

Retenção inicial de logs: 14 dias, com acesso restrito. Métricas agregadas: 90 dias. Ajustes exigem
revisão de minimização e capacidade.
