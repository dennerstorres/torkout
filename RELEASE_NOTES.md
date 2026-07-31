# Torkout 1.0.0

**Data:** 31/07/2026

**Instância de produção:** <https://torkout.dennerstorres.dev>

Primeira versão completa do Torkout: planejar, registrar e acompanhar treinos, caminhadas, medidas
corporais, hábitos alimentares e ocorrências de dor, com registro rápido no celular e funcionamento
offline.

## Destaques

- Interface escura mobile-first, com Hoje como entrada, navegação persistente, painel de Progresso
  separado da execução e estado de sincronização compreensível em toda a aplicação.
- Planejamento recorrente, Hoje, histórico, hábitos, dor, medidas e indicadores.
- Persistência local-first particionada por conta, outbox durável, sincronização idempotente e
  resolução explícita de conflitos, sem last-write-wins silencioso.
- Progressão conservadora, explicável, opcional e versionada, sem diagnóstico e sem alteração
  automática do plano.
- Lançamento retroativo de treino, marcado de forma permanente e nunca apresentado como registro
  feito no dia.
- Exportação JSON/CSV em ZIP, exclusão de conta, documentos legais versionados e consentimento
  específico para dados de saúde.
- PWA instalável com app shell offline, atualização consentida, acessibilidade automatizada e
  imagens de produção não root.

## Operação e segurança

- PostgreSQL privado com usuário mínimo, migração one-shot, readiness/liveness, métricas sem PII,
  headers/CSP/HSTS e logs redigidos.
- Threat model, auditoria de autorização, scans de segredo e de imagem, e runbooks de deploy,
  rollback e incidente.
- Implantação no Coolify com HTTPS, domínio, DNS e SMTP em funcionamento; Postgres e API sem portas
  públicas.
- O rollback da aplicação 0.11 permanece compatível com os documentos legais anteriores após a
  migração aditiva `0008_release_rollback_compatibility.sql`.

## Validação

- `pnpm check` verde: governança, verificações de fase, scan de segredos, formatação, lint,
  typecheck, testes unitários e build.
- Testes de integração contra PostgreSQL real e E2E Playwright com axe-core.
- Checklist físico aprovado pelo titular em iPhone, Android e desktop reais, incluindo instalação,
  modo standalone, safe areas, teclado, leitor de tela, retomada de sessão, Hoje offline e
  atualização. Reconfirmado em iPhone físico em 31/07/2026 ao longo das Fases 21 a 25.

## Limitações conhecidas

Itens que não bloqueiam o uso pessoal atual, mas seguem abertos e já estão planejados:

- **Backup externo não comprovado.** O job de backup, o runbook e o ensaio de restauração existem,
  mas a restauração aprovada em 15/07/2026 usou um archive local. Ainda faltam bucket externo,
  lifecycle 7 diários / 5 semanais / 12 mensais e uma restauração feita a partir de um objeto
  realmente enviado. Planejado na Fase 26 do [`PLAN.md`](PLAN.md).
- **CI de segurança sem execução verde confirmada.** Os dois scans Trivy 0.72.0 de imagem estão
  declarados em `.github/workflows/security.yml` e passaram localmente na Fase 13, mas nunca houve
  execução verde registrada no GitHub Actions no SHA candidato. Planejado na Fase 27.

## Escopo

O Torkout registra e resume o que o usuário informa. Ele não diagnostica, não prescreve e não
substitui orientação médica, fisioterapêutica, nutricional ou de educação física. Ausência de
registro de dor nunca é interpretada como ausência de dor.

Estão fora desta versão, conforme o [`SPEC.md`](SPEC.md): rede social ou competição entre usuários,
contagem rigorosa de calorias e macronutrientes, pagamentos, integração com Apple Health, Health
Connect ou wearables, compartilhamento com terceiros e aplicativos publicados em lojas.

A instância de produção é de uso pessoal do autor e não está aberta a cadastros. Para usar o
Torkout, hospede a própria cópia — ver [`README.md`](README.md) e
[`docs/operations/`](docs/operations/).
