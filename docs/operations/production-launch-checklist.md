# Checklist de abertura pública 1.0.0

## Build e dados

- [ ] Commit da Fase 13 identificado e tag `v1.0.0` apontando para o mesmo SHA.
- [ ] `pnpm check`, integração, E2E, restauração e segurança verdes no SHA da tag.
- [ ] Backup extraordinário concluído antes da migração.
- [ ] Migração one-shot terminou com código 0; API só iniciou depois dela.
- [ ] Rollback para a imagem anterior ensaiado sem reverter migração.

## Produção

Os quatro primeiros itens foram atestados pelo titular em 31/07/2026, com a instância no ar em
<https://torkout.dennerstorres.dev>. A evidência é a declaração do titular, não uma captura do painel.

- [x] Coolify saudável e expõe somente web por HTTPS.
- [x] Certificado, redirecionamento HTTP→HTTPS, HSTS e cookies seguros confirmados externamente.
- [x] PostgreSQL/API sem portas públicas; usuário da aplicação continua mínimo.
- [x] Domínio, DNS reverso quando aplicável, SMTP e remetente verificado funcionando.
- [ ] Métricas/alertas e contato de incidente testados sem conteúdo pessoal.

## Backup e privacidade

Os três primeiros itens são o escopo da Fase 26 do `PLAN.md` e seguem abertos: o ensaio aprovado em
15/07/2026 restaurou um archive local, não um objeto vindo de bucket externo.

- [ ] Bucket externo recebeu archive/checksum com credencial restrita.
- [ ] Lifecycle 7 diários, 5 semanais e 12 mensais comprovado.
- [ ] Restauração isolada a partir do objeto externo dentro de RPO/RTO.
- [ ] Aviso, termos, consentimento e canal do controlador revisados no domínio real.

## Dispositivos e abertura

- [x] Checklist físico da Fase 11 completo em iPhone, Android e desktop.
- [x] Hoje offline aprovado em iPhone físico; instalação/retomada/update aprovados nos três alvos.
- [x] Leitor de tela, teclado, zoom, contraste e linguagem de saúde revisados manualmente.
- [ ] `phase-13-acceptance-checklist.md` sem `BLOQUEADO` ou `PENDENTE`.
- [ ] Release notes publicadas e responsável autorizou explicitamente a abertura.
