# Preparação de domínio, DNS e SMTP

## Domínio/HTTPS

- [ ] Definir domínio público pertencente ao titular.
- [ ] Criar A/AAAA somente para o proxy Coolify; nunca apontar diretamente ao PostgreSQL/API.
- [ ] Ativar certificado automático e redirecionamento HTTPS.
- [ ] Definir `AUTH_BASE_URL`/`TRUSTED_ORIGINS` com a origem final exata.
- [ ] Validar CAA, renovação e HSTS após o primeiro deploy saudável.

## E-mail

- [ ] Verificar remetente/domínio no provedor SMTP.
- [ ] Publicar SPF restrito e DKIM fornecido pelo provedor.
- [ ] Publicar DMARC inicialmente `p=none`, coletar relatórios e evoluir para quarantine/reject.
- [ ] Configurar credencial SMTP exclusiva com privilégio somente de envio e rotação documentada.
- [ ] Testar confirmação e recuperação sem incluir dado de saúde no assunto/corpo.
- [ ] Monitorar bounce/abuso sem registrar senha, token integral ou conteúdo pessoal.

Valores reais ficam no secret store do Coolify. Este checklist só pode ser marcado com evidência
do DNS/provedor; placeholders não contam como configuração de produção.
