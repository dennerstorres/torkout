# Torkout 1.0.0

Data candidata: 15/07/2026

## Destaques

- Nova interface premium escura, mobile-first, com Hoje como entrada, navegação persistente,
  dashboard separado do runner e sincronização global compreensível.
- Planejamento, Hoje, histórico, hábitos, dor, medidas e indicadores em experiência mobile-first.
- Persistência local-first particionada por conta, outbox durável, sincronização idempotente e
  resolução explícita de conflitos.
- Progressão conservadora, explicável, opcional e versionada, sem diagnóstico ou alteração
  automática do plano.
- Exportação JSON/CSV ZIP, exclusão de conta, documentos legais versionados e consentimento
  específico para dados de saúde.
- PWA instalável com app shell offline, atualização consentida, acessibilidade automatizada e
  imagens de produção não root.

## Operação e segurança

- PostgreSQL privado com usuário mínimo, migração one-shot, readiness/liveness, métricas sem PII,
  headers/CSP/HSTS e logs redigidos.
- Backup S3 compatível, ensaio isolado de restauração, threat model, scans de segredo/imagem e
  runbooks de deploy, rollback e incidente.
- O rollback da aplicação 0.11 permanece compatível com os documentos legais anteriores após a
  migração aditiva `0008_release_rollback_compatibility.sql`.

## Pendências que impedem abertura pública

- Checklist físico de iPhone, Android e desktop, incluindo Hoje offline em iPhone real.
- Coolify/HTTPS, domínio/DNS/SMTP e evidência externa de portas privadas.
- Bucket externo, lifecycle 7/5/12 e restauração de um backup realmente enviado.
- Job CI final com Trivy 0.72.0 e remoção do container/cache preso após reiniciar o Docker Desktop.

Esta candidata não deve receber tag pública enquanto qualquer item acima estiver aberto.
