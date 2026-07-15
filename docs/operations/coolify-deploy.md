# Deploy no Coolify

## Recursos

1. Criar projeto/ambiente de produção e importar `compose.production.yml`.
2. Expor somente `web:8080` pelo proxy HTTPS do Coolify.
3. Manter `api:3000` e PostgreSQL apenas na rede privada `backend`; não publicar suas portas.
4. Criar volume persistente para `/var/lib/postgresql` (PostgreSQL 18).
5. Configurar todos os valores marcados com `:?` no secret store, nunca no Git.
6. Usar URL pública HTTPS idêntica em `AUTH_BASE_URL` e `TRUSTED_ORIGINS`.
7. Aguardar o serviço one-shot `migrate`, que usa a credencial owner e deve terminar com código 0
   antes de a API iniciar.
8. Liberar tráfego somente após healthchecks web e API verdes.

## Ordem de deploy

1. Backup extraordinário se houver migração destrutiva.
2. Build por digest/commit; scans sem HIGH/CRITICAL.
3. Subir PostgreSQL/rede; o `migrate` executa as migrações com owner e bloqueia a API se falhar.
4. Subir API e aguardar `/health/ready`.
5. Subir web, validar `/health/live`, headers, login e Hoje.
6. Registrar commit, horário e responsável no evento de deploy do Coolify.

## Validação HTTPS

- Certificado válido, redirecionamento HTTP→HTTPS e HSTS na resposta pública.
- Cookies `Secure`, `HttpOnly`, `SameSite=Lax`.
- Banco/API sem porta pública em varredura externa.
- Proxy preserva `X-Forwarded-Proto` e usa somente CIDRs de `TRUST_PROXY` aprovados.

Credenciais reais, domínio e evidência do painel permanecem externos ao repositório.
