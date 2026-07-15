# Runbook de incidente

## Classificação

- **SEV-1:** exposição/perda de dados, conta comprometida, banco/backup público ou indisponibilidade total.
- **SEV-2:** degradação relevante, sync/autenticação falhando ou restauração atrasada.
- **SEV-3:** falha localizada sem risco de dados.

## Resposta

1. Designar responsável, horário UTC e canal restrito; não copiar conteúdo de saúde.
2. Conter: revogar segredo/sessão, bloquear tráfego, isolar container ou pausar deploy.
3. Preservar evidência mínima: commit, digest, request IDs, logs redigidos e eventos do provedor.
4. Avaliar titulares/dados/período afetados e obrigações legais aplicáveis.
5. Erradicar por teste de regressão, scan e rotação de credenciais.
6. Recuperar gradualmente com readiness, métricas e validação de sync.
7. Comunicar pelos canais legais no prazo aplicável, sem especulação clínica.
8. Fazer retrospectiva em até 5 dias úteis e atualizar threat model/runbooks.

O acesso emergencial ao PostgreSQL precisa de justificativa, duração limitada e registro auditável.
