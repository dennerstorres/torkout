# Torkout — Plano de Implementação

**Base:** `SPEC.md` versão 1.1

**Método obrigatório:** TDD Red → Green → Refactor

**Unidade de entrega:** fase completa com commit de encerramento

**Status geral:** Fases 0–18 implementadas; validação física concluída, e lançamento público ainda aguarda validações externas

## 1. Regras de execução

1. Ler `SPEC.md`, `PLAN.md`, `HISTORY.md` e `CLAUDE.md` antes de trabalhar.
2. Executar as fases na ordem, salvo dependência explicitamente atualizada neste plano.
3. Antes de cada comportamento, criar teste, executá-lo e confirmar falha pelo motivo esperado.
4. Implementar o mínimo necessário para o teste passar.
5. Executar novamente e confirmar sucesso.
6. Refatorar e executar testes afetados.
7. Não marcar tarefa como concluída sem evidência verificável.
8. Atualizar `HISTORY.md` durante o fechamento da fase.
9. Executar todos os critérios de saída da fase.
10. Criar um commit de encerramento para toda fase concluída.
11. Não iniciar a fase seguinte com alterações não commitadas da anterior.
12. Se uma fase revelar mudança de arquitetura, atualizar primeiro `SPEC.md` e registrar ADR.

## 2. Definição de concluído por tarefa

Uma tarefa de implementação está concluída quando:

- O cenário Red falhou pela ausência do comportamento, não por erro de infraestrutura.
- A implementação Green passou.
- Testes de regressão relevantes passaram.
- Tipagem, lint e formatação passaram.
- Erros e estados vazios foram tratados.
- Autorização e privacidade foram consideradas.
- Funcionamento offline foi considerado quando aplicável.
- Contrato/API/documentação foram atualizados.
- Não existem `TODO`, `.skip`, `.only` ou mocks permanentes não registrados.

## 3. Definição de concluído por fase

Uma fase só pode ser encerrada quando:

- Todas as tarefas e critérios de aceite da fase estiverem satisfeitos.
- A suíte exigida estiver verde.
- `HISTORY.md` contiver resumo, evidências, decisões, desvios e pendências.
- O worktree estiver revisado e sem artefatos ou segredos.
- Houver commit único de encerramento com mensagem convencional.
- O status da fase neste arquivo estiver atualizado no mesmo commit.

O hash não é escrito no próprio `HISTORY.md`, evitando o ciclo em que alterar o arquivo mudaria o hash. A mensagem de commit é registrada e o hash permanece consultável no Git.

## 4. Fases

### Fase 0 — Repositório e governança

**Status:** concluída

**Commit esperado:** `chore(phase-0): establish project governance`

#### Tarefas

- [x] Inicializar ou conectar o diretório a um repositório Git.
- [x] Confirmar branch principal e política de branches.
- [x] Adicionar `.gitignore`, `.editorconfig` e política de fim de linha.
- [x] Validar e versionar `SPEC.md`, `PLAN.md`, `HISTORY.md` e `CLAUDE.md`.
- [x] Criar `docs/adr/` e template de ADR.
- [x] Criar ADR da stack, ADR da estratégia offline e ADR de autenticação.
- [x] Definir licença do projeto.
- [x] Definir política de versões e Conventional Commits.
- [x] Definir política de atualização de dependências.

#### Testes/verificações primeiro

- [x] Criar verificação automatizada de links e lint Markdown; confirmar falha antes de corrigir documentos/configuração.
- [x] Criar verificação que exige os documentos de governança.

#### Critérios de saída

- Repositório Git funcional.
- Documentos e ADRs versionados.
- Verificações documentais verdes.
- Primeiro commit de fase criado.

### Fase 1 — Monorepo e qualidade básica

**Status:** concluída

**Commit esperado:** `chore(phase-1): scaffold monorepo and quality gates`

#### Tarefas

- [x] Configurar `pnpm` workspace.
- [x] Criar `apps/web`, `apps/api` e pacotes compartilhados.
- [x] Configurar TypeScript estrito.
- [x] Configurar lint, formatador e ordenação de imports.
- [x] Configurar Vitest para unidades/componentes.
- [x] Configurar Playwright para E2E.
- [x] Configurar ambiente PostgreSQL efêmero para integração.
- [x] Criar scripts raiz de check, test e build.
- [x] Configurar CI com instalação travada, lint, typecheck, testes e build.
- [x] Criar Dockerfiles de desenvolvimento/release mínimos.
- [x] Criar validação tipada de variáveis de ambiente.

#### Testes/verificações primeiro

- [x] Teste de fumaça web inicialmente falhando.
- [x] Teste de fumaça API inicialmente falhando.
- [x] Teste de importação do pacote de contratos inicialmente falhando.
- [x] Teste de validação de ambiente inicialmente falhando.

#### Critérios de saída

- `pnpm install --frozen-lockfile`, lint, typecheck, testes e builds verdes.
- CI reproduz os mesmos comandos locais.
- Nenhum segredo ou valor de produção no repositório.

### Fase 2 — Banco, contratos fundamentais e datas

**Status:** concluída

**Commit esperado:** `feat(phase-2): establish database and core contracts`

#### Tarefas

- [x] Configurar Drizzle e PostgreSQL.
- [x] Criar convenções de UUID, timestamps, versão e tombstone.
- [x] Implementar schema de identidade exigido pelo Better Auth.
- [x] Implementar perfil, documentos e aceites de privacidade.
- [x] Implementar exercícios e catálogo inicial.
- [x] Implementar entidades de planejamento e execução.
- [x] Implementar dor, hábitos, medidas e progressão.
- [x] Implementar change log, operações de sync e dispositivos.
- [x] Criar migração inicial revisada.
- [x] Criar factories de testes, sem dados pessoais reais.
- [x] Implementar utilitários de UTC, data civil e fuso IANA.
- [x] Criar índices, uniques e checks definidos na especificação.

#### Testes primeiro

- [x] Banco vazio migra até a versão atual.
- [x] Constraints rejeitam valores inválidos.
- [x] Relacionamentos preservam histórico.
- [x] Tombstone e versão funcionam.
- [x] Datas próximas da meia-noite mantêm data civil correta.
- [x] Fuso alterado não reescreve histórico.

#### Critérios de saída

- Migração funciona em banco limpo.
- Testes de schema usam PostgreSQL real.
- Modelo cobre todas as entidades do `SPEC.md`.

### Fase 3 — Autenticação, cadastro público e privacidade

**Status:** concluída

**Commit esperado:** `feat(phase-3): implement secure public authentication`

#### Tarefas

- [x] Integrar Better Auth ao Fastify e Drizzle.
- [x] Configurar Argon2id.
- [x] Implementar cadastro e confirmação de e-mail.
- [x] Integrar SMTP configurável.
- [x] Implementar login, logout e recuperação de senha.
- [x] Implementar cookies e proteção CSRF/origin.
- [x] Implementar rate limiting e bloqueio temporário.
- [x] Implementar aceite versionado de privacidade/dados de saúde.
- [x] Implementar sessões listáveis e revogáveis.
- [x] Implementar papel administrativo mínimo.
- [x] Implementar bloqueio administrativo auditado, sem exposição de conteúdo de saúde.
- [x] Criar telas acessíveis de autenticação.
- [x] Criar fluxo de onboarding e perfil.
- [x] Implementar pedido de exclusão com reautenticação.
- [x] Implementar autorização offline local com validade máxima de 30 dias.

#### Testes primeiro

- [x] Cadastro válido/inválido e e-mail duplicado sem enumeração.
- [x] Conta não confirmada possui acesso restrito.
- [x] Token expirado ou reutilizado é rejeitado.
- [x] Senha nunca aparece em texto puro no banco/log.
- [x] Reset revoga sessões conforme política.
- [x] CSRF/origem inválida é bloqueada.
- [x] Rate limit funciona.
- [x] Usuário A não acessa perfil de B.
- [x] Bloqueio administrativo impede novas sessões e não revela dados de saúde.
- [x] Acesso local funciona dentro da validade offline e exige revalidação depois dela sem apagar a outbox.
- [x] Fluxos web completos por E2E.

#### Critérios de saída

- Jornadas públicas e autenticadas verdes.
- Teste de isolamento horizontal verde.
- Conteúdo sensível ausente nos logs.

### Fase 4 — Fundação de sincronização local-first

**Status:** concluída

**Commit esperado:** `feat(phase-4): implement local-first sync foundation`

#### Tarefas

- [x] Criar banco Dexie particionado por usuário.
- [x] Modelar réplica local, outbox, cursor e metadados.
- [x] Implementar transação local dado + operação.
- [x] Implementar `/sync/push` com resultados por item.
- [x] Implementar idempotência persistente.
- [x] Implementar `change_log` e `/sync/pull` paginado.
- [x] Implementar versão otimista e tombstones.
- [x] Implementar máquina de estados de sincronização.
- [x] Implementar reautenticação preservando outbox.
- [x] Implementar limpeza/retenção de tombstones.
- [x] Implementar UI base de pendências e conflito.

#### Testes primeiro

- [x] Reload não perde mutação local.
- [x] Mesmo push repetido não duplica registro.
- [x] Queda após commit do servidor é recuperada idempotentemente.
- [x] Operações fora de ordem são tratadas.
- [x] Versão antiga gera conflito.
- [x] Tombstone não ressuscita.
- [x] Operação inválida não bloqueia o restante do lote.
- [x] Usuários diferentes não compartilham IndexedDB lógico.
- [x] Sessão expirada preserva e depois envia pendências.

#### Critérios de saída

- Harness de rede instável verde.
- Sincronização genérica pronta para entidades de domínio.
- Estado de sync observável e compreensível.

### Fase 5 — Exercícios, templates e planejamento

**Status:** concluída

**Commit esperado:** `feat(phase-5): implement workout planning`

#### Tarefas

- [x] CRUD de exercícios do usuário.
- [x] Catálogo inicial de flexão e agachamento.
- [x] CRUD de planos e templates.
- [x] Séries por repetições, duração e distância.
- [x] Regras semanais e horários locais.
- [x] Materializador de sessões futuras idempotente.
- [x] Alteração com vigência futura.
- [x] Sessões avulsas, reagendamento e cancelamento.
- [x] Múltiplas sessões por data.
- [x] UI mobile-first de planejamento.
- [x] Sincronização offline das entidades da fase.

#### Testes primeiro

- [x] Alterar template não muda sessão histórica.
- [x] Materializar duas vezes não duplica.
- [x] Alterar regra afeta somente futuro não iniciado.
- [x] Segunda/sexta e fuso são calculados corretamente.
- [x] Mais de uma sessão no dia é suportada.
- [x] Dados de outro usuário permanecem inacessíveis.
- [x] Jornada de planejar offline e sincronizar por E2E.

#### Critérios de saída

- Planejamento completo online e offline.
- Snapshots históricos comprovados por teste.

### Fase 6 — Tela Hoje e registros diários

**Status:** concluída

**Commit esperado:** `feat(phase-6): implement daily workout tracking`

#### Tarefas

- [x] Dashboard da data atual no fuso do usuário.
- [x] Execução por série e métrica.
- [x] Conclusão total, parcial, interrupção e exercício ignorado.
- [x] Salvamento incremental local.
- [x] Caminhadas e detalhes.
- [x] Relatos de dor com região, intensidade e momento.
- [x] Confirmação explícita de ausência de dor articular.
- [x] Definições e entradas de hábitos.
- [x] Hábitos iniciais de café, arroz, proteína e salada.
- [x] Peso e cintura.
- [x] Observações por sessão/exercício/dor.
- [x] Estados visuais de sincronização.
- [x] Cadastro autenticado do histórico de 13/07/2026 pela interface/importação, nunca como seed global.

#### Testes primeiro

- [x] Séries planejadas e reais são independentes.
- [x] Série adicional não altera template.
- [x] Parcialidade é calculada corretamente.
- [x] Dor durante a série mantém o vínculo correto.
- [x] Ausência não confirmada continua desconhecida.
- [x] Um hábito/data respeita unicidade.
- [x] Múltiplas medidas no dia são aceitas.
- [x] Formulário sobrevive a reload offline.
- [x] Jornada completa Hoje em viewport móvel.

#### Critérios de saída

- Registro diário funcional com e sem rede.
- Nenhum dado digitado se perde em reload testado.

### Fase 7 — Motor de progressão explicável

**Status:** concluída

**Commit esperado:** `feat(phase-7): implement explainable progression engine`

#### Tarefas

- [x] Implementar framework versionado de regras puras.
- [x] Implementar avaliação idempotente por evidência.
- [x] Regra de duas sessões elegíveis e `+1` repetição/série.
- [x] Regras de dor muscular leve, moderada e forte.
- [x] Bloqueio de aumento por dor articular.
- [x] Regra específica de dor pé/tornozelo durante agachamento.
- [x] Regra de sessão perdida sem compensação.
- [x] Limites configuráveis por exercício.
- [x] Persistir evidências e explicação.
- [x] Tela de sugestões, aceite, recusa e adiamento.
- [x] Aceite cria mudança futura, sem alterar passado.
- [x] Reavaliar/invalidar sugestão quando chega dor atrasada.
- [x] Exibir avisos de segurança e persistir versão textual aplicável.

#### Testes primeiro

- [x] Matriz completa de cada regra e intensidade.
- [x] Dado ausente não é interpretado como ausência de dor.
- [x] Duas sessões sem dor explícita geram uma única sugestão.
- [x] Uma sessão com dor articular bloqueia aumento.
- [x] Dor atrasada invalida sugestão ainda não aceita.
- [x] Aceitar duas vezes é idempotente.
- [x] Aceite afeta somente sessões futuras.
- [x] Versão nova não altera avaliação histórica.
- [x] Property-based tests para limites e não negatividade.

#### Critérios de saída

- Todas as regras da especificação estão implementadas e explicáveis.
- Nenhuma sugestão é aplicada sem ação explícita.
- Revisão manual de linguagem não diagnóstica concluída.

### Fase 8 — Calendário e edição histórica

**Status:** concluída

**Commit esperado:** `feat(phase-8): implement calendar and history`

#### Tarefas

- [x] Calendário mensal responsivo.
- [x] Badges separados para estado e tipo.
- [x] Múltiplas sessões por data.
- [x] Detalhe diário agregado.
- [x] Edição de sessão, hábitos, medidas e dores.
- [x] Filtros por tipo, estado e dor.
- [x] Estado perdido derivado/confirmado.
- [x] Tratamento correto de descanso e cancelamento.
- [x] Indicador de pendência/conflito por dia.
- [x] Sincronização offline e paginação histórica.

#### Testes primeiro

- [x] Dia com caminhada e força mostra ambos.
- [x] Descanso não vira perdido.
- [x] Dia passado planejado segue regra de `missed`.
- [x] Edição histórica não altera template.
- [x] Filtros combinados são corretos.
- [x] Navegação por calendário funciona offline.

#### Critérios de saída

- Histórico pesquisável e editável sem cor como único indicador.

### Fase 9 — Progresso, indicadores e gráficos

**Status:** concluída

**Commit esperado:** `feat(phase-9): implement progress analytics`

#### Tarefas

- [x] Consultas/agregações de peso e cintura.
- [x] Totais e evolução por exercício.
- [x] Consistência semanal versionada.
- [x] Caminhadas, distância e frequência.
- [x] Treinos concluídos e parciais.
- [x] Dor por tipo, intensidade e região.
- [x] Filtros temporais.
- [x] API paginada/agregada.
- [x] Gráficos acessíveis com alternativa textual/tabular.
- [x] Estados vazios e dados insuficientes.
- [x] Cache local das últimas análises.

#### Testes primeiro

- [x] Fórmulas com semanas vazias, parciais, descanso e cancelamento.
- [x] Intervalos e limites de data inclusivos.
- [x] Soma de repetições e caminhadas.
- [x] Séries removidas/ignoradas não contaminam totais.
- [x] Dor atrasada aparece no período correto.
- [x] Gráficos possuem nomes e alternativa acessível.

#### Critérios de saída

- Todos os indicadores do `SPEC.md` disponíveis e explicados.
- Consultas dentro da meta de desempenho em dataset de referência.

### Fase 10 — Exportação, portabilidade e exclusão

**Status:** concluída

**Commit esperado:** `feat(phase-10): implement data portability and erasure`

#### Tarefas

- [x] Definir e versionar schema do JSON.
- [x] Exportar todas as entidades autorizadas.
- [x] Gerar ZIP com CSVs normalizados.
- [x] Documentar datas, unidades e relacionamentos no pacote.
- [x] Incluir alterações locais pendentes quando solicitado.
- [x] Excluir tokens e metadados internos.
- [x] Implementar exclusão de conta e dados ativos.
- [x] Documentar retenção inevitável de backups.
- [x] Limpar réplica local após exclusão confirmada.

#### Testes primeiro

- [x] Exportação round-trip estrutural.
- [x] CSV preserva acentos e abre corretamente.
- [x] Nenhum segredo/sessão aparece no pacote.
- [x] Usuário não exporta outro usuário.
- [x] Outbox pendente é marcada corretamente.
- [x] Exclusão torna conta e dados inacessíveis.

#### Critérios de saída

- JSON e CSV validados por fixtures públicas sem dados reais.
- Fluxo de exclusão E2E verde.

### Fase 11 — PWA, iOS e acessibilidade

**Status:** concluída — validação física em iOS, Android e desktop confirmada em 16/07/2026

**Commit esperado:** `feat(phase-11): harden pwa and mobile experience`

#### Tarefas

- [x] Manifesto completo e ícones.
- [x] App shell e cache versionado.
- [x] Estratégias de cache por classe de recurso.
- [x] Atualização segura do service worker.
- [x] Fluxo de instalação para iOS, Android e desktop.
- [x] Safe areas e teclado móvel.
- [x] Estado standalone e retomada.
- [x] Auditoria WCAG 2.2 AA, incluindo verificação manual física.
- [x] Navegação por teclado, foco e leitores de tela, incluindo verificação manual física.
- [x] Contraste, movimento reduzido e alvos de toque.
- [x] Teste em iPhone, Android e desktop físicos confirmado pelo titular em 16/07/2026.

#### Testes primeiro

- [x] Manifesto e service worker falham auditoria antes da configuração.
- [x] App shell carrega offline.
- [x] Atualização não perde formulário/outbox.
- [x] Testes automatizados de acessibilidade nas jornadas.
- [x] Checklist manual em aparelhos físicos; modelos e versões não foram registrados pelo titular.

#### Critérios de saída

- Instalável nos três grupos de plataforma.
- Jornada Hoje funciona offline em iPhone físico.
- Sem violação automática crítica de acessibilidade.

**Desvio autorizado:** em 15/07/2026, o titular solicitou o commit da fase e a continuidade
para a Fase 12 por não poder executar os testes físicos agora. Os itens manuais permanecem
abertos e voltaram como bloqueadores na Fase 13. O desvio foi encerrado em 16/07/2026 pela
confirmação do titular em iPhone, Android e desktop físicos.

### Fase 12 — Segurança, observabilidade e operação

**Status:** concluída por autorização do titular — validação externa diferida para a Fase 13

**Commit esperado:** `chore(phase-12): productionize security and operations`

#### Tarefas

- [x] Produzir threat model.
- [x] Revisar autorização de todos os endpoints.
- [x] Configurar CSP, headers e proxy confiável.
- [x] Redigir dados sensíveis dos logs.
- [x] Criar métricas e alertas sem conteúdo pessoal.
- [x] Implementar liveness/readiness.
- [x] Configurar scans de dependência, imagem e segredo.
- [x] Criar Dockerfiles de produção com usuário não root.
- [ ] Configurar serviços no Coolify — composição validada localmente; falta instância real.
- [x] Configurar PostgreSQL privado e usuário mínimo.
- [ ] Configurar backup externo e retenção — job/política prontos; falta bucket e lifecycle reais.
- [x] Executar e documentar restauração.
- [x] Criar runbooks de deploy, rollback, incidente e recuperação.
- [x] Publicar aviso de privacidade e termos aplicáveis.
- [x] Preparar SMTP, domínio e DNS de produção.

#### Testes primeiro

- [x] Testes negativos de autorização para todos os recursos.
- [x] Verificação de headers e cookies.
- [x] Scanner detecta fixture insegura antes da correção.
- [x] Readiness falha quando dependência essencial está indisponível.
- [x] Teste de carga nominal e abuso de autenticação.
- [x] Exercício de restauração mede RPO/RTO.

#### Critérios de saída

- Nenhum achado crítico/alto sem mitigação aprovada.
- Backup restaurado em ambiente isolado.
- Coolify executa containers saudáveis sob HTTPS.

**Impedimento externo:** o repositório não contém — corretamente — acesso à instância Coolify,
domínio, DNS, SMTP nem credenciais/bucket de backup. A composição completa ficou saudável em
ambiente local, mas isso não substitui certificado, rota externa, lifecycle do bucket e evidência
do painel de produção.

**Desvio autorizado:** em 15/07/2026, o titular autorizou explicitamente diferir Coolify/HTTPS e
backup externo para a Fase 13 e commitar a Fase 12. Os dois itens continuam abertos e são
bloqueadores obrigatórios do lançamento; a autorização não vale como deploy nem backup aprovado.

### Fase 13 — Validação integral e lançamento

**Status:** concluída por autorização do titular — validações externas permanecem bloqueadoras do lançamento

**Commit esperado:** `release(phase-13): validate public launch`

#### Tarefas

- [x] Executar suíte completa em ambiente limpo.
- [x] Executar E2E online, offline e reconexão.
- [x] Executar testes multiusuário e dois dispositivos.
- [x] Validar conflito real entre dispositivos.
- [x] Validar todas as regras de progressão.
- [x] Validar exportação e exclusão.
- [x] Testar upgrade de versão anterior e rollback de aplicação.
- [x] Fazer auditoria manual de privacidade e linguagem de saúde.
- [x] Fazer teste exploratório em iOS, Android e desktop físicos.
- [x] Corrigir achados por TDD.
- [x] Congelar schema/contratos da versão 1.0.
- [x] Criar release notes e checklist de abertura pública.

#### Testes primeiro

- [x] Criar checklist executável de aceite baseado na seção 17 do `SPEC.md`.
- [x] Registrar falhas encontradas antes de correções.
- [x] Reexecutar toda a suíte após cada correção de release.

#### Critérios de saída

- Todos os critérios de aceite do produto satisfeitos.
- Histórico completo e nenhum bloqueador conhecido.
- Release versionada e deploy de produção validado.

**Evidência local em 15/07/2026:** `pnpm check` passou com 33 arquivos/138 testes; integração
PostgreSQL com 12 arquivos/50 testes; Playwright com 15/15 jornadas; restauração com 32 tabelas,
RPO 0,0003 hora e RTO 6,89 segundos; Trivy 0.72.0 encontrou zero HIGH/CRITICAL corrigível nas
imagens finais da API e do web.

**Bloqueadores de lançamento:** AC-09 foi aprovado pelo titular em 16/07/2026. AC-10 ainda depende
de Coolify/HTTPS/DNS/SMTP, bucket/lifecycle e restauração a partir do objeto externo. Sem essa
evidência externa, AC-01 permanece pendente e o produto não deve receber tag nem ser aberto ao
público.

**Desvio autorizado:** em 15/07/2026, depois de toda a validação local ficar verde, o titular
autorizou explicitamente commitar a Fase 13 no estado atual e informou que executará os testes
pendentes depois. A autorização encerra a unidade de implementação, mas não equivale a evidência
física/externa e não autoriza tag `v1.0.0`, deploy ou abertura pública.

### Fase 14 — Refactor UI/UX premium

**Status:** implementada e validada — checklist físico de AC-09 aprovado em 16/07/2026

**Commit esperado:** `feat(web): deliver premium UI UX refactor`

**Referência visual:** projeto Stitch `Torkout: Redesign Premium PWA`, preservado em
`design/stitch/`

**Objetivo:** substituir a interface atual por uma experiência mobile-first coerente, acessível e
adequada ao uso durante o treino, preservando as regras de negócio, a persistência local, a
sincronização, os contratos e os fluxos já validados nas Fases 0–13.

O HTML exportado pelo Stitch é apenas uma especificação visual. Ele não deve ser incorporado
diretamente ao bundle, pois contém Tailwind via CDN, fontes remotas, Material Symbols e scripts do
próprio Stitch, incompatíveis com o requisito offline-first.

#### Direção visual e técnica

- Tema escuro com superfícies `#0e0e0e`, `#131313`, `#1c1b1b`, `#201f1f` e `#353534`.
- Destaque primário `#d4ff00`, secundário `#7000ff` e destrutivo `#ff4d4d`.
- Geist para títulos e Inter para corpo quando os arquivos puderem ser empacotados localmente e
  suas licenças forem confirmadas; até lá, usar fallbacks de sistema.
- Ícones em SVG local por meio de componente React; não depender de Material Symbols remoto.
- CSS semântico do projeto; não adicionar Tailwind apenas para reproduzir os arquivos exportados.
- Navegação por estado existente mantida no primeiro ciclo. Adoção de roteador fica fora desta
  fase, salvo necessidade funcional comprovada.

#### Arquitetura alvo

```text
App
├── PublicShell
│   ├── Auth
│   ├── ResetPassword
│   └── Onboarding
└── AuthenticatedShell
    ├── AppHeader
    ├── PrimaryNavigation
    ├── SyncStatusButton
    ├── SyncDetails
    └── PageOutlet
        ├── TodayPage
        ├── WorkoutSessionPage
        ├── PlanningPage
        ├── HistoryPage
        ├── ProgressPage
        ├── ProgressionPage
        └── AccountPage
```

Os componentes compartilhados devem incluir, no mínimo, `Button`, `Card`, `EmptyState`, `Field`,
`Icon`, `MetricCard`, `PageHeader`, `ProgressBar`, `StatusBadge` e `VisuallyHidden`. Tokens, base,
shell, componentes e estilos por feature devem ser separados gradualmente a partir do atual
`styles.css`, sem uma migração massiva em um único commit.

#### Etapa 14.0 — Baseline e codificação

- [x] Normalizar os arquivos web e os testes para UTF-8 e corrigir textos com mojibake.
- [x] Catalogar nomes acessíveis usados pelos testes unitários e E2E.
- [x] Criar baseline visual determinístico nos viewports 390 × 844 e 1440 × 900.
- [x] Consolidar helpers de teste para sessão, IndexedDB e estados de sincronização.
- [x] Confirmar typecheck, testes web e jornadas E2E antes da primeira mudança visual.

**Critério de saída:** baseline verde, sem texto corrompido e com referências visuais revisáveis.

#### Etapa 14.1 — Design system e shell autenticado

- [x] Criar tokens semânticos de cor, espaço, raio, sombra, tipografia, controle e movimento.
- [x] Criar componentes primitivos acessíveis e seus testes.
- [x] Criar `AuthenticatedShell` com barra inferior no mobile e sidebar no desktop.
- [x] Manter Hoje, Planejamento, Histórico, Progresso e Conta sempre acessíveis.
- [x] Transformar `SyncPanel` em indicador global com detalhes expansíveis para pending, retry,
      exportação e conflitos.
- [x] Preservar skip link, foco no `h1`, `prefers-reduced-motion`, forced colors e safe areas.
- [x] Fazer Hoje ser a entrada autenticada, removendo a home intermediária de botões.

**Critério de saída:** todas as áreas podem ser acessadas sem voltar à home; offline, erro e
conflito continuam visíveis e operáveis.

#### Etapa 14.2 — Hoje e treino em execução

- [x] Separar o dashboard diário do modo focado de execução atualmente misturados em
      `TodayScreen.tsx`.
- [x] Criar dashboard com saudação, data, resumo semanal, treino principal, hábitos e registros
      rápidos.
- [x] Criar estado vazio com ação para planejar ou adicionar treino avulso.
- [x] Criar runner com progresso, exercício, séries, métrica, notas, pular, interromper e adicionar
      série.
- [x] Preservar repetições, duração e distância como métricas distintas.
- [x] Manter confirmação de ausência de dor e alerta conservador específico para dor articular.
- [x] Permitir conclusão completa, parcial, perdida ou cancelada conforme as regras existentes.
- [x] Garantir persistência no IndexedDB antes de qualquer tentativa de sincronização.

**Critério de saída:** todas as mutações existentes funcionam offline, sobrevivem ao reload e são
operáveis com uma mão em 360 px sem scroll horizontal.

#### Etapa 14.3 — Planejamento

- [x] Reorganizar desktop em agenda, planos e editor; usar fluxo vertical e dialogs/sheets no
      mobile.
- [x] Separar catálogo, exercício personalizado, template recorrente e treino avulso.
- [x] Implementar ordenação acessível sem tornar drag-and-drop obrigatório.
- [x] Destacar que alterações recorrentes afetam apenas o futuro.
- [x] Preservar criação, edição e outbox offline.

**Critério de saída:** jornadas atuais de planejamento offline passam e todo o editor é operável por
teclado.

#### Etapa 14.4 — Histórico, progresso e progressão

- [x] Usar master/detail no Histórico, com duas colunas no desktop e fluxo sequencial no mobile.
- [x] Manter um botão acessível por dia, nome civil completo, legenda e status de sincronização.
- [x] Exibir planejado versus executado no detalhe histórico.
- [x] Criar cards de KPI e manter cada gráfico acompanhado por tabela acessível.
- [x] Tratar dados insuficientes com estados vazios acionáveis.
- [x] Usar linguagem não diagnóstica para dor e fadiga.
- [x] Trocar evidência de progressão em `pre` por conteúdo estruturado e expansível.
- [x] Preservar aceite, adiamento e recusa explícitos; nenhuma sugestão é aplicada automaticamente.

**Critério de saída:** Histórico e Progresso reabrem do cache offline, permanecem acessíveis e não
alteram regras ou fórmulas existentes.

#### Etapa 14.5 — Conta, autenticação e estados transversais

- [x] Organizar Conta em perfil, sincronização/dados, sessões e zona de risco.
- [x] Diferenciar logout mantendo dados locais de logout removendo dados, com confirmação adequada.
- [x] Preservar exportação, revogação de sessão e exclusão de conta.
- [x] Harmonizar Auth, Onboarding, Reset Password, instalação PWA e bloqueio offline.
- [x] Criar padrões únicos para loading, vazio, erro, offline, pending e conflito.

**Critério de saída:** fluxos de conta e telas públicas mantêm cobertura e passam axe/WCAG AA.

#### Etapa 14.6 — Polimento e remoção do legado

- [x] Remover classes e componentes sem consumidores.
- [x] Validar em dispositivos físicos mobile, desktop, zoom de 200%, teclado e safe areas de iOS (gate AC-09).
- [x] Validar contraste, reduced motion e forced colors.
- [x] Confirmar que fontes, ícones e assets necessários são cacheados pela PWA.
- [x] Verificar bundle e manter lazy loading de análises.
- [x] Atualizar screenshots, documentação, `HISTORY.md` e evidências da fase.

**Critério de saída:** nenhuma dependência remota é necessária para renderizar a aplicação, não há
CSS legado relevante e todos os gates do repositório passam.

#### Testes primeiro

- [x] Criar testes de componentes para papéis, labels, foco, teclado e estados disabled/loading.
- [x] Criar testes das variantes de sincronização, incluindo pending, offline, error e conflict.
- [x] Atualizar os E2E de Hoje para cobrir dashboard e runner como fluxos distintos.
- [x] Preservar E2E de planejamento offline, histórico em cache, progresso em cache, progressão,
      portabilidade e reconexão idempotente.
- [x] Adicionar screenshots Playwright determinísticos em 390 × 844 e 1440 × 900.
- [x] Executar axe nas principais páginas públicas e autenticadas.
- [x] Executar `pnpm typecheck`, testes unitários web, E2E relacionados, lint e build em cada corte.

#### Sequência de entregas

1. UTF-8, baseline visual e helpers de teste.
2. Tokens e componentes primitivos.
3. Shell, navegação e status global de sincronização.
4. Dashboard Hoje.
5. Treino em execução.
6. Planejamento.
7. Histórico.
8. Progresso e progressão.
9. Conta e fluxos públicos.
10. Limpeza, acessibilidade e performance.

Cada entrega deve manter o repositório funcional. Mudanças visuais e mudanças de regra de negócio
não devem ser misturadas. Lacunas funcionais percebidas nos mocks do Stitch devem ser registradas
como trabalho posterior, não implementadas implicitamente durante o refactor.

#### Critérios de saída

- Navegação persistente e responsiva em todas as áreas autenticadas.
- Hoje é a entrada principal após autenticação.
- Dashboard e execução são experiências distintas sobre a mesma fonte de dados local.
- Todas as funções existentes permanecem disponíveis online e offline.
- Estado de sincronização compreensível, sem expor detalhes técnicos por padrão.
- Contraste, foco, teclado, zoom, reduced motion e leitores de tela suportados.
- Nenhuma dependência de Tailwind CDN, Google Fonts ou Material Symbols em runtime.
- Interface coerente com o Stitch sem scripts ou markup do Stitch no bundle.
- Testes unitários, E2E, typecheck, lint, formatação e build verdes.

**Reavaliação em 15/07/2026:** a auditoria visual no ambiente de homologação, em desktop e
mobile, reprovou o aceite de qualidade premium desta fase. A implementação funcional e seus
testes permanecem como registro histórico, mas os snapshots existentes não constituem aprovação
de design. A recuperação, a nova direção visual e os novos gates de aceite pertencem à Fase 15.

### Fase 15 — Recuperação UI/UX premium e estabilização visual

**Status:** implementação concluída e aceita — validação física concluída; gates externos permanecem

**Commit esperado:** `feat(web): rebuild premium responsive experience`

**Motivação:** a auditoria visual da homologação encontrou desequilíbrio estrutural no desktop,
cards e controles sem separação adequada, excesso de superfícies aninhadas, ocupação excessiva
do shell no mobile, inconsistência de idioma e estados assíncronos capazes de deslocar ou trocar o
conteúdo fora da viewport. O baseline visual da Fase 14 reproduz esses defeitos e, portanto, deve
ser substituído somente depois de aprovação humana do novo resultado.

**Objetivo:** reconstruir a apresentação e a interação da aplicação como um sistema visual
coerente, responsivo, estável e deliberadamente premium, preservando contratos, regras de negócio,
persistência offline, sincronização, privacidade e acessibilidade existentes.

#### Skill auxiliar obrigatória para execução da fase

A Fase 15 deve usar a skill externa `redesign-existing-projects`, do repositório MIT
`Leonxlnx/taste-skill`, como checklist auxiliar de auditoria e crítica visual. Não instalar nem usar
por padrão `design-taste-frontend`, `gpt-taste` ou o pacote completo: essas variantes têm escopo e
direção mais próximos de landing pages, portfólios e motion experimental do que de uma PWA de
treino com formulários, dados e funcionamento offline.

Antes de iniciar qualquer tarefa da Fase 15, o agente executor deve:

1. Confirmar se `redesign-existing-projects` está disponível com `npx skills list` e pela lista de
   skills exposta no próprio ambiente.
2. Se estiver ausente, consultar a revisão atual antes de instalar:

   ```powershell
   git ls-remote https://github.com/Leonxlnx/taste-skill.git refs/heads/main
   ```

   A revisão avaliada durante a elaboração deste plano foi
   `b17742737e796305d829b3ad39eda3add0d79060`. Se `main` apontar para outro commit, revisar o diff
   da skill `redesign-existing-projects`, sua licença e suas instruções antes de continuar, e
   registrar a nova revisão aprovada no `HISTORY.md`.

3. Depois da verificação, instalar somente essa skill no escopo global do agente executor. Para
   Codex, usar:

   ```powershell
   npx skills add https://github.com/Leonxlnx/taste-skill --skill redesign-existing-projects --global --agent codex --yes
   ```

4. Se o executor não for Codex, trocar apenas o valor de `--agent`, mantendo a origem e o nome da
   skill. Não instalar para todos os agentes sem necessidade.
5. Ler o `SKILL.md` completo já instalado antes da auditoria ou implementação e registrar no
   `HISTORY.md` a origem, o commit efetivamente instalado, o escopo de instalação e a data de
   leitura.
6. Confirmar que o conteúdo instalado corresponde a `redesign-existing-projects` e que nenhuma
   outra skill do repositório foi ativada implicitamente.

A skill é consultiva. `SPEC.md`, este plano, acessibilidade, estabilidade de navegação, desempenho,
offline-first, privacidade e decisões explícitas do titular sempre têm precedência. Recomendações
de scroll com inércia, parallax, animação cinematográfica, grids propositalmente quebrados,
glassmorphism, imagens placeholder remotas ou efeitos decorativos não devem ser aplicadas sem
justificativa específica, teste em mobile, suporte a reduced motion e aceite humano.

Se a instalação falhar por indisponibilidade externa, mudança do repositório ou incompatibilidade
do CLI, registrar o impedimento e a evidência no `HISTORY.md`. A fase pode continuar usando o
inventário, os princípios e os critérios de aceite deste plano; não se deve trocar silenciosamente
por outra skill, usar a revisão mais recente sem reauditoria nem bloquear uma correção funcional
urgente apenas pela ausência da ferramenta consultiva.

#### Princípios obrigatórios

- Hierarquia antes de decoração: superfície, borda e sombra devem comunicar agrupamento real.
- Densidade adequada ao contexto: desktop deve aproveitar largura; mobile deve priorizar uma mão,
  leitura rápida e controles de no mínimo 44 × 44 px.
- Nenhuma rota ou carga assíncrona pode preservar scroll indevido, ocultar o `h1` ou exibir
  navegação ativa incompatível com o conteúdo.
- Estados de loading devem reservar a geometria final ou usar skeletons estáveis, sem saltos de
  layout perceptíveis.
- Textos de produto devem estar em português consistente; valores internos, enums e chaves de
  contrato não podem aparecer na interface.
- Snapshots automatizados detectam regressão depois da aprovação humana; não substituem revisão
  visual nem tornam uma tela premium por estarem verdes.
- Mudanças visuais não podem alterar regras de treino, fórmulas, datas civis, outbox ou resolução
  de conflitos.

#### Etapa 15.0 — Auditoria, inventário e novo contrato visual

- [x] Verificar a disponibilidade de `redesign-existing-projects`; instalar a revisão documentada
      apenas se estiver ausente e registrar a evidência no `HISTORY.md`.
- [x] Ler a skill completa e produzir uma lista explícita de recomendações aplicáveis, rejeitadas e
      pendentes de aceite para o contexto do Torkout.
- [x] Registrar no `HISTORY.md` a reprovação do aceite visual da Fase 14 e suas evidências.
- [ ] Capturar todas as telas e estados relevantes em 390 × 844, 768 × 1024, 1440 × 900 e
      1920 × 1080, incluindo loading, vazio, erro, offline, pending e conflito.
- [x] Inventariar componentes, seletores duplicados, regras sobrescritas e CSS sem consumidor.
- [x] Mapear cards aninhados, grids implícitos, larguras máximas, elementos sticky/fixed e pontos de
      quebra atuais.
- [x] Catalogar textos com enums, termos em inglês, mensagens técnicas ou codificação incorreta.
- [x] Definir wireframes aprováveis para Hoje, Planejamento, Histórico, Progresso e Conta antes do
      polimento de alta fidelidade.
- [x] Definir matriz de densidade, hierarquia, espaçamento e comportamento responsivo por tela.
- [x] Definir orçamento de layout shift, overflow, tamanho de alvo e contraste.
- [x] Marcar os snapshots atuais como baseline legado reprovado, sem apagá-los antes da nova
      aprovação.

**Critério de saída:** inventário completo, wireframes revisados e contrato visual documentado com
comparativo objetivo entre estado atual e estado alvo.

#### Etapa 15.1 — Arquitetura CSS e design system

- [x] Separar `styles.css` em tokens, base, layout, componentes e estilos por feature, preservando
      uma ordem de cascata explícita.
- [x] Eliminar definições duplicadas de `.card`, layouts, PWA, navegação e componentes globais.
- [x] Consolidar tokens de espaçamento, largura de conteúdo, raio, borda, sombra, tipografia,
      movimento e elevação.
- [x] Criar primitivas distintas para `Surface`, `Section`, `Panel`, `Metric`, `EmptyState` e
      `FormGroup`, evitando que todo agrupamento seja um `Card`.
- [x] Definir variantes compacta, padrão e destacada sem combinações arbitrárias de padding.
- [x] Corrigir `MetricCard` para separar rótulo e valor, controlar quebra de linha e manter ritmo
      vertical em todos os viewports.
- [x] Padronizar campos, selects, checkboxes, botões e grupos de ações com estados hover, focus,
      active, disabled, loading, success e danger.
- [x] Criar testes de componente para variantes, nomes acessíveis e contratos de classe/estrutura.
- [x] Impedir overflow horizontal em 320 px, 360 px, 390 px, 430 px e zoom de 200%.

**Critério de saída:** nenhuma regra global importante possui redefinição concorrente; primitivas
têm responsabilidades claras e uma página-laboratório demonstra todos os estados suportados.

#### Etapa 15.2 — Shell, navegação e estabilidade assíncrona

- [x] Redesenhar o shell desktop com sidebar proporcional, cabeçalho compacto e largura de
      conteúdo adequada a cada feature.
- [x] Redesenhar o shell mobile para reduzir a área anterior ao conteúdo e respeitar safe areas.
- [x] Tornar a experiência de instalação PWA contextual, recolhível e dispensável; ela não pode
      ocupar permanentemente o topo do produto.
- [x] Garantir que a barra inferior não encubra ações, campos, mensagens ou o fim do conteúdo.
- [x] Resetar ou restaurar scroll de forma intencional em toda navegação, inclusive após cargas
      assíncronas e retorno de detalhes.
- [x] Reservar espaço para calendários, indicadores e gráficos durante loading para impedir scroll
      anchoring e layout shift.
- [x] Sincronizar destino ativo, `h1`, conteúdo e foco como uma transação visual única.
- [x] Evitar flashes da tela anterior, áreas vazias extensas e estados intermediários incoerentes.
- [x] Preservar skip link, teclado, retorno de foco, reduced motion e forced colors.
- [x] Criar testes E2E que naveguem a partir de posições de scroll profundas e validem o topo da
      nova tela antes e depois do carregamento.

**Critério de saída:** todas as trocas de área exibem o destino correto sem salto perceptível,
sem `h1` fora da viewport e sem sobreposição da navegação fixa.

#### Etapa 15.3 — Hoje e treino em execução

- [x] Projetar a tela Hoje por áreas explícitas, eliminando o grid genérico que iguala alturas e
      cria vazios entre resumo, treino e registros.
- [x] Criar resumo responsivo com rótulos e valores claramente separados, sem composição 2 + 1
      arbitrária no mobile.
- [x] Dar prioridade visual ao próximo treino e reduzir o peso de status e informações auxiliares.
- [x] Simplificar o estado de descanso sem card dentro de card e com uma única ação principal.
- [x] Agrupar hábitos, dor e medidas por frequência e contexto de uso, evitando formulários longos
      competindo simultaneamente.
- [x] Avaliar progressive disclosure para dor e medidas sem esconder informação obrigatória.
- [x] Refinar o runner para leitura rápida, progresso evidente e ações alcançáveis com uma mão.
- [x] Validar todos os estados de sessão, dor, hábitos, medidas, offline e sincronização.
- [x] Preservar mutações no IndexedDB e outbox antes de qualquer feedback de sincronização.

**Critério de saída:** Hoje comunica prioridade em até cinco segundos, não possui vazios causados
por grid e permite concluir as tarefas principais sem disputar atenção com formulários secundários.

#### Etapa 15.4 — Planejamento

- [x] Separar visualmente catálogo, criação de exercício, plano recorrente e sessão avulsa.
- [x] No desktop, usar navegação mestre/detalhe ou etapas claras em vez de duas colunas longas e
      independentes.
- [x] No mobile, substituir a sequência de formulários completos por fluxo progressivo, sheet ou
      página de edição dedicada.
- [x] Transformar listas de exercícios em itens escaneáveis, com métrica traduzida e ações claras.
- [x] Revisar largura, agrupamento e ordem dos campos de plano semanal.
- [x] Dar tratamento visual consistente a dias da semana, recorrência, horário e vigência.
- [x] Simplificar sessões avulsas e controles de reagendamento/ordenação.
- [x] Preservar edição por teclado, alternativa ao drag-and-drop e comportamento offline.

**Critério de saída:** criar ou alterar um planejamento apresenta uma decisão por etapa, sem
formulários concorrentes, e continua totalmente operável por teclado e offline.

#### Etapa 15.5 — Histórico

- [x] Redesenhar cabeçalho do mês e controles anterior/próximo como um conjunto reconhecível.
- [x] Reorganizar filtros com rótulos, densidade e comportamento responsivo consistentes.
- [x] Reservar a geometria do calendário durante loading para impedir deslocamento da viewport.
- [x] Melhorar contraste e legibilidade de dia atual, dia selecionado, dias externos e badges.
- [x] Limitar badges no calendário e mover detalhes excedentes para legenda ou painel de detalhe.
- [x] Manter painel de detalhes proporcional no desktop e fluxo sequencial no mobile.
- [x] Criar estados vazios informativos para dias sem registro, sem transformar o painel em uma
      caixa visualmente dominante.
- [x] Validar meses de quatro, cinco e seis semanas, textos longos e múltiplos registros no mesmo dia.

**Critério de saída:** o calendário não muda a posição da página ao carregar, filtros não
competem com a navegação mensal e o detalhe selecionado permanece inequívoco.

#### Etapa 15.6 — Progresso e progressão

- [x] Integrar seletor de período ao cabeçalho ou toolbar, reduzindo a superfície vazia inicial.
- [x] Redesenhar KPIs com hierarquia numérica, unidades consistentes e rótulos escaneáveis.
- [x] Agrupar gráficos por narrativa e prioridade, evitando uma pilha indiferenciada de cards.
- [x] Definir alturas estáveis para loading, gráfico, tabela acessível e dados insuficientes.
- [x] Corrigir todo texto corrompido, sem acento, em inglês ou derivado diretamente de enum.
- [x] Traduzir tipo, métrica, região, status e evidência por uma camada de apresentação testada.
- [x] Melhorar leitura de dor registrada sem sugerir diagnóstico ou causalidade.
- [x] Refinar sugestões de progressão, evidências e ações de aceitar, adiar e recusar.
- [x] Preservar tabelas acessíveis sem duplicá-las visualmente quando não forem necessárias.

**Critério de saída:** o usuário identifica tendência, período e principal resultado sem
percorrer toda a página; nenhum valor interno ou texto corrompido é exibido.

#### Etapa 15.7 — Conta, autenticação e experiência PWA

- [x] Remover o padrão de card principal contendo cards secundários em Conta.
- [x] Organizar Perfil, Dados, Sessões e Zona de risco como seções com hierarquia e separação
      apropriadas, sem borda em todos os níveis.
- [x] Limitar largura de leitura dos textos explicativos sem estreitar desnecessariamente a página
      inteira no desktop.
- [x] Diferenciar ações primárias, secundárias e destrutivas por posição, cor e confirmação.
- [x] Harmonizar autenticação, onboarding, redefinição de senha e bloqueio offline com o novo shell.
- [x] Mostrar instalação PWA como convite contextual e manter instruções completas sob demanda.
- [x] Preservar exportação, revogação, logout com/sem dados e exclusão de conta.
- [x] Testar mensagens longas, erros de sessão, reautenticação e confirmações destrutivas.

**Critério de saída:** Conta apresenta hierarquia clara sem nested-card visual, a zona de risco
não domina a página e a instalação PWA não reduz permanentemente a área útil.

#### Etapa 15.8 — Conteúdo, microinterações e acabamento

- [x] Criar dicionário de apresentação para enums e unidades vindos de contratos e IndexedDB.
- [x] Revisar toda microcópia para clareza, consistência de tom e linguagem não diagnóstica.
- [x] Padronizar formatos de data, hora, número, distância, repetição e percentuais.
- [x] Definir feedbacks de salvar, sincronizar, falhar, ficar offline e resolver conflito sem expor
      estados internos como `synced`.
- [x] Adicionar transições discretas somente quando comunicarem mudança de estado.
- [x] Garantir equivalência funcional com `prefers-reduced-motion`.
- [x] Revisar ícones, alinhamento óptico, truncamento, quebra de linha e estados de foco.
- [x] Validar conteúdo com nomes longos, traduções extensas e valores extremos.

**Critério de saída:** toda informação exibida pertence à linguagem do produto, feedbacks são
compreensíveis e o acabamento permanece estável com conteúdo realista.

#### Etapa 15.9 — Validação visual, acessibilidade e performance

- [x] Criar testes de regressão para scroll, layout shift, overflow e sobreposição de elementos
      fixed/sticky.
- [x] Validar componentes e jornadas com axe, teclado, leitor de tela, zoom de 200%, reduced motion,
      forced colors e alto contraste.
- [x] Medir CLS das telas com carga assíncrona e manter o valor dentro do orçamento definido na
      Etapa 15.0.
- [x] Validar 320, 360, 390 e 430 px; tablet retrato/paisagem; 1366, 1440 e 1920 px.
- [x] Validar iPhone com safe area, Android/Chrome e desktop em dispositivos físicos.
- [x] Executar jornadas completas online, offline, reconexão, conflito e reload com outbox pendente.
- [x] Revisar cada tela lado a lado com o contrato visual e registrar aceite humano explícito.
- [ ] Substituir snapshots legados somente depois do aceite humano de cada viewport.
- [ ] Ampliar regressão visual para shell, Hoje, Planejamento, Histórico, Progresso e Conta, nos
      estados representativos definidos na auditoria.
- [x] Executar `pnpm check`, integração PostgreSQL, E2E, build, auditoria de bundle e verificações
      de release.
- [x] Atualizar `HISTORY.md`, evidências e checklist AC-09; snapshots novos continuam em tarefa própria.

**Critério de saída:** aceite humano registrado para desktop e mobile; zero overflow ou
sobreposição bloqueante; navegação e loading sem saltos; WCAG 2.2 AA; dispositivos físicos
validados; snapshots e gates completos verdes.

#### Testes primeiro

- [x] Criar teste falhando que reproduza o salto de scroll após Histórico e Progresso carregarem.
- [x] Criar teste falhando para destino ativo incompatível com `h1` e conteúdo durante navegação.
- [x] Criar teste falhando para rótulo e valor sem separação no `MetricCard`.
- [x] Criar teste falhando para sobreposição da barra inferior e para shell excessivo no mobile.
- [x] Criar teste falhando para enums/termos internos exibidos ao usuário.
- [x] Criar teste falhando para overflow em viewports e zoom suportados.
- [x] Criar testes de layout por invariantes geométricas; evitar coordenadas frágeis quando uma
      relação semântica ou de bounding box for suficiente.
- [x] Manter testes funcionais existentes verdes durante cada corte da reconstrução.

#### Etapa 15.10 — Retorno detalhado do aceite visual

- [x] Reagrupar Hábitos, Dor e Peso para eliminar o cartão órfão de Hoje no desktop sem alterar a
      ordem mobile.
- [x] Fixar 16 px entre o título e a lista do catálogo de exercícios em Planejamento.
- [x] Fixar 24 px entre Voltar e a eyebrow da tela de Progressão.
- [x] Agrupar a opção de exportação e seus botões com 16 px em Conta.
- [x] Substituir a autenticação desktop dividida por landing compacta e modais acessíveis de login,
      cadastro e recuperação; preservar ergonomia mobile como folha inferior.
- [x] Criar `DESIGN.md` como contrato obrigatório de cores, tipografia, dimensões, espaçamento,
      componentes, responsividade, acessibilidade e governança.
- [x] Medir as correções no Chrome em 390 × 844 e 1440 × 900 e automatizar os invariantes de
      geometria.
- [x] Padronizar padding, alvo e hover das ações terciárias nos modais de login, cadastro e
      recuperação, inclusive quando duas ações dividem a linha mobile.
- [x] Unificar marca do login, shell, favicon, Apple Touch Icon e ícones PWA na mesma fonte vetorial,
      com variante maskable restrita à área segura.
- [x] Registrar novo aceite humano das áreas ajustadas e da landing em mobile e desktop.
- [x] Formalizar o ritmo interno de 8 px entre label/controle e 16 px entre campos ou
      título/conteúdo; auditar todas as páginas autenticadas e automatizar a geometria.

#### Sequência de entregas

1. Preparação da skill auxiliar, auditoria, wireframes, contrato visual e novos testes Red.
2. Arquitetura CSS, tokens e primitivas.
3. Shell, PWA, navegação, foco, scroll e loading estável.
4. Hoje e treino em execução.
5. Planejamento.
6. Histórico.
7. Progresso e progressão.
8. Conta, autenticação e conteúdo transversal.
9. Polimento, dispositivos físicos, aceite humano e novos snapshots.

Cada corte deve ser revisável isoladamente, manter regras e dados intactos e encerrar com evidência
visual em desktop e mobile. Nenhum snapshot novo deve ser aceito apenas para tornar a CI verde.

#### Critérios de saída da fase

- Auditoria e aceite humano documentados para todas as telas principais.
- Shell compacto e responsivo, sem instalação PWA permanentemente dominante.
- Navegação sem salto de scroll, flash da tela anterior ou destino/conteúdo incompatíveis.
- Grids específicos por tela, sem vazios estruturais nem alturas acidentalmente compartilhadas.
- Rótulos, valores, unidades e ações visualmente separados e linguisticamente consistentes.
- Redução comprovada de cards aninhados, bordas e superfícies sem função hierárquica.
- Hoje, Planejamento, Histórico, Progresso e Conta aprovados em desktop e mobile.
- Loading, vazio, erro, offline, pending e conflito estáveis e visualmente coerentes.
- Sem overflow horizontal, controles encobertos ou perda de conteúdo nos viewports suportados.
- Funcionalidade online/offline, acessibilidade, privacidade e segurança sem regressão.
- Snapshots visuais aprovados por pessoa e cobertura ampliada para as telas principais.
- `pnpm check`, integração, E2E, build e verificações de release verdes.

### Fase 16 — Planejamento completo e antropometria extensível

**Status:** concluída

**Commit esperado:** `feat(phase-16): complete planning and body measurements`

**Objetivo:** permitir que uma conta vazia reproduza por cadastro qualquer calendário pessoal de
treino, caminhada e recuperação, inclusive retroativo, e registre medidas corporais livres sem
dados pessoais ou importadores dedicados no produto.

#### Etapa 16.1 — Planejamento e lançamentos retroativos

- [x] Remover o importador dedicado ao histórico de 13/07/2026 da interface, contratos e API.
- [x] Corrigir domingo para o valor ISO `7` em todo o editor.
- [x] Permitir escolher força, caminhada, descanso ou outra atividade.
- [x] Permitir vários exercícios por template, com ordem, quantidade de séries e alvo próprios.
- [x] Tratar caminhada como uma atividade única de distância/duração.
- [x] Permitir vigência inicial/final passada ou futura.
- [x] Materializar localmente a janela do plano e enfileirar sessões sem depender de job externo.
- [x] Permitir sessão avulsa completa em qualquer data, com os mesmos detalhes do planejamento.
- [x] Preservar início vazio e estados vazios acionáveis.

#### Etapa 16.2 — Medidas corporais extensíveis

- [x] Ampliar contrato e banco para medidas adicionais estruturadas e versionadas.
- [x] Oferecer abdômen, bíceps, coxa, quadril/glúteos, pescoço, peito e panturrilha.
- [x] Permitir nome personalizado, unidade e valor.
- [x] Permitir data retroativa na tela Hoje e no Histórico.
- [x] Sincronizar, exportar e exibir as medidas adicionais sem quebrar peso/cintura existentes.
- [x] Preservar isolamento por usuário, conflito explícito e outbox local-first.

#### Testes primeiro

- [x] Teste Red para template com dois exercícios e séries diferentes.
- [x] Teste Red para caminhada única de 5 km e descanso no domingo.
- [x] Teste Red para materialização local idempotente e sessão avulsa retroativa completa.
- [x] Teste Red para conta vazia sem importador pessoal.
- [x] Teste Red de contrato, schema, sync e UI para medidas adicionais/customizadas.
- [x] Teste Red para medição contendo apenas circunferência e data retroativa.
- [x] Regressão de histórico, analytics, portabilidade, offline e autorização.

#### Critérios de saída

- Um usuário consegue cadastrar pela interface um calendário equivalente ao HTML de referência,
  sem qualquer preset ou dado pessoal no código.
- Sessões planejadas aparecem localmente em Hoje/Histórico antes da sincronização e sobrevivem a
  reload offline.
- Lançamentos retroativos usam os mesmos contratos e proteções dos registros atuais.
- Medidas corporais adicionais aparecem no registro e histórico e atravessam sync/exportação.
- Testes, integração afetada, E2E, typecheck, lint, formatação e build verdes.
- `HISTORY.md` atualizado e fase encerrada em commit próprio.

### Fase 17 — Guia de uso e transcrição do calendário de referência

**Status:** concluída

**Commit esperado:** `docs(phase-17): add complete user guide`

**Objetivo:** oferecer uma referência em português para o primeiro acesso, uso diário, operação
offline e cadastro manual de um calendário equivalente ao HTML que originou a aplicação.

#### Escopo

- [x] Documentar cadastro, primeiro acesso, navegação, sincronização e instalação PWA.
- [x] Documentar exercícios, planos semanais, sessões avulsas e registros retroativos.
- [x] Documentar treino do dia, hábitos, dores, medições, histórico, progresso e exportação.
- [x] Traduzir o HTML de referência em uma sequência concreta de cadastros por período.
- [x] Explicar limites de alvos em faixa, progressões, medições quinzenais e calendário aberto.
- [x] Validar consistência com a interface atual e os documentos de segurança/privacidade.

#### Critérios de saída

- O guia permite que uma pessoa sem contexto técnico configure e use a aplicação.
- O plano de referência pode ser reproduzido manualmente sem seed ou importação automática.
- Instruções distinguem planejamento, execução real e lançamento retroativo.
- Formatação, governança documental e links internos verdes.
- `HISTORY.md` atualizado e fase encerrada em commit próprio.

### Fase 18 — CRUD de hábitos diários personalizados

**Status:** concluída

**Commit esperado:** `feat(phase-18): add daily habit management`

**Objetivo:** completar `HABIT-004` e `HABIT-005` com uma interface local-first para criar,
consultar, editar, ativar, desativar e excluir logicamente hábitos personalizados, preservando o
histórico e o isolamento por titular.

#### Escopo

- [x] Adicionar a área Hábitos ao Planejamento.
- [x] Permitir criar hábitos booleanos, de quantidade, escala e escolha.
- [x] Permitir editar nome, tipo, unidade e opções sem invalidar entradas históricas.
- [x] Permitir ativar e desativar um hábito preservando seu histórico.
- [x] Permitir exclusão lógica sincronizável e cancelamento seguro de criação ainda local.
- [x] Atualizar o guia do usuário com o novo fluxo.

#### Testes primeiro

- [x] RED de componente para criação dos quatro tipos, edição, ativação/desativação e exclusão.
- [x] RED de sincronização local para excluir criação pendente e substituir atualização pendente por tombstone.
- [x] RED de API/sync para atualizar opções preservando IDs referenciados pelo histórico.
- [x] Regressão de Hoje, Histórico, offline, typecheck, lint, formatação e build.

#### Critérios de saída

- O CRUD funciona offline e cada mutação aplicável gera dado local e outbox atomicamente.
- Desativar ou excluir um hábito não apaga entradas históricas.
- Opções de escolha já referenciadas não são removidas fisicamente nem recriadas com outro ID.
- Testes afetados, typecheck, lint, formatação e build verdes.
- `HISTORY.md` atualizado e fase encerrada em commit próprio.

### Fase 19 — CRUD de exercícios, planos semanais e sessões avulsas

**Status:** concluída

**Commit esperado:** `feat(phase-19): add planning entity management`

**Objetivo:** completar o Planejamento com criação, consulta, edição e exclusão local-first de
exercícios personalizados, planos semanais e sessões avulsas, sem permitir alterações no catálogo
do sistema nem apagar o histórico de treinos já executados.

#### Escopo

- [x] Permitir editar, ativar, desativar e excluir exercícios personalizados.
- [x] Permitir editar e excluir planos semanais e seus templates, aplicando mudanças ao futuro.
- [x] Permitir editar integralmente e excluir sessões avulsas ainda planejadas.
- [x] Manter sessões iniciadas ou concluídas como histórico imutável no Planejamento.
- [x] Sincronizar todas as mutações pela réplica local e outbox existentes.
- [x] Atualizar o guia do usuário com os novos fluxos.

#### Testes primeiro

- [x] RED de componente para edição e exclusão dos três agregados.
- [x] RED de contratos/API/sync para edição integral de sessão avulsa planejada.
- [x] RED de preservação de sessões históricas ao alterar ou excluir planejamento recorrente.
- [x] Regressão de Hoje, Histórico, offline, typecheck, lint, formatação e build.

#### Critérios de saída

- O CRUD funciona offline e produz estado local e outbox atomicamente.
- Exercícios do catálogo do sistema permanecem somente leitura.
- Alterações recorrentes não reescrevem sessões já iniciadas, concluídas ou históricas.
- Sessões avulsas já iniciadas não podem ter sua composição reescrita ou ser excluídas.
- Testes afetados, integração, E2E, typecheck, lint, formatação e build verdes.
- `HISTORY.md` atualizado e fase encerrada em commit próprio.

### Fase 20 — Exercícios iniciais pertencentes à conta

**Status:** concluída

**Commit esperado:** `refactor(phase-20): make initial exercises user-owned`

**Objetivo:** substituir o catálogo global imutável por exercícios iniciais normais de cada conta,
permitindo o mesmo CRUD local-first aplicado aos exercícios cadastrados posteriormente.

#### Escopo

- [x] Criar flexão, agachamento livre e caminhada automaticamente para cada nova conta.
- [x] Migrar contas existentes e suas referências antes de remover os registros globais.
- [x] Remover o marcador e as regras especiais de exercício de sistema do schema, API, sync e UI.
- [x] Permitir editar, ativar, desativar e excluir todos os exercícios exibidos no Planejamento.
- [x] Atualizar especificação, ADR, guia do usuário e histórico.

#### Testes primeiro

- [x] RED de schema para seed por conta e ausência de exercícios globais.
- [x] RED de API/sync para isolamento e CRUD dos exercícios iniciais.
- [x] RED de componente para exibir as ações de gestão nos exercícios iniciais.
- [x] Regressão de Planejamento, Hoje, Histórico, integração, E2E e gates completos.

#### Critérios de saída

- Toda linha de `exercises` pertence a um usuário e nenhuma regra de catálogo global permanece.
- O cadastro de conta gera os três exercícios e os publica no pull local-first.
- Referências de contas existentes continuam apontando para exercícios da própria conta.
- Os três exercícios iniciais oferecem editar, ativar/desativar e excluir.
- Testes afetados, integração, E2E, typecheck, lint, formatação e build verdes.
- `HISTORY.md` atualizado e fase encerrada em commit próprio.

## 5. Dependências entre fases

```text
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20
```

Trabalhos internos de uma mesma fase podem ser paralelos somente quando não compartilham arquivos ou contratos instáveis. O encerramento continua único.

## 6. Registro de impedimentos

Um impedimento deve ser registrado no `HISTORY.md` com:

- fase e tarefa;
- evidência observada;
- tentativas realizadas;
- impacto;
- decisão necessária;
- próximo passo seguro.

Não se reduz cobertura, segurança, privacidade ou escopo silenciosamente para contornar impedimento.
