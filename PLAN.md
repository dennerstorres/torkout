# Torkout — Plano de Implementação

**Base:** `SPEC.md` versão 1.0

**Método obrigatório:** TDD Red → Green → Refactor

**Unidade de entrega:** fase completa com commit de encerramento

**Status geral:** Fase 0 concluída; Fase 1 ainda não iniciada

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

**Status:** pendente

**Commit esperado:** `chore(phase-1): scaffold monorepo and quality gates`

#### Tarefas

- [ ] Configurar `pnpm` workspace.
- [ ] Criar `apps/web`, `apps/api` e pacotes compartilhados.
- [ ] Configurar TypeScript estrito.
- [ ] Configurar lint, formatador e ordenação de imports.
- [ ] Configurar Vitest para unidades/componentes.
- [ ] Configurar Playwright para E2E.
- [ ] Configurar ambiente PostgreSQL efêmero para integração.
- [ ] Criar scripts raiz de check, test e build.
- [ ] Configurar CI com instalação travada, lint, typecheck, testes e build.
- [ ] Criar Dockerfiles de desenvolvimento/release mínimos.
- [ ] Criar validação tipada de variáveis de ambiente.

#### Testes/verificações primeiro

- [ ] Teste de fumaça web inicialmente falhando.
- [ ] Teste de fumaça API inicialmente falhando.
- [ ] Teste de importação do pacote de contratos inicialmente falhando.
- [ ] Teste de validação de ambiente inicialmente falhando.

#### Critérios de saída

- `pnpm install --frozen-lockfile`, lint, typecheck, testes e builds verdes.
- CI reproduz os mesmos comandos locais.
- Nenhum segredo ou valor de produção no repositório.

### Fase 2 — Banco, contratos fundamentais e datas

**Status:** pendente

**Commit esperado:** `feat(phase-2): establish database and core contracts`

#### Tarefas

- [ ] Configurar Drizzle e PostgreSQL.
- [ ] Criar convenções de UUID, timestamps, versão e tombstone.
- [ ] Implementar schema de identidade exigido pelo Better Auth.
- [ ] Implementar perfil, documentos e aceites de privacidade.
- [ ] Implementar exercícios e catálogo inicial.
- [ ] Implementar entidades de planejamento e execução.
- [ ] Implementar dor, hábitos, medidas e progressão.
- [ ] Implementar change log, operações de sync e dispositivos.
- [ ] Criar migração inicial revisada.
- [ ] Criar factories de testes, sem dados pessoais reais.
- [ ] Implementar utilitários de UTC, data civil e fuso IANA.
- [ ] Criar índices, uniques e checks definidos na especificação.

#### Testes primeiro

- [ ] Banco vazio migra até a versão atual.
- [ ] Constraints rejeitam valores inválidos.
- [ ] Relacionamentos preservam histórico.
- [ ] Tombstone e versão funcionam.
- [ ] Datas próximas da meia-noite mantêm data civil correta.
- [ ] Fuso alterado não reescreve histórico.

#### Critérios de saída

- Migração funciona em banco limpo.
- Testes de schema usam PostgreSQL real.
- Modelo cobre todas as entidades do `SPEC.md`.

### Fase 3 — Autenticação, cadastro público e privacidade

**Status:** pendente

**Commit esperado:** `feat(phase-3): implement secure public authentication`

#### Tarefas

- [ ] Integrar Better Auth ao Fastify e Drizzle.
- [ ] Configurar Argon2id.
- [ ] Implementar cadastro e confirmação de e-mail.
- [ ] Integrar SMTP configurável.
- [ ] Implementar login, logout e recuperação de senha.
- [ ] Implementar cookies e proteção CSRF/origin.
- [ ] Implementar rate limiting e bloqueio temporário.
- [ ] Implementar aceite versionado de privacidade/dados de saúde.
- [ ] Implementar sessões listáveis e revogáveis.
- [ ] Implementar papel administrativo mínimo.
- [ ] Implementar bloqueio administrativo auditado, sem exposição de conteúdo de saúde.
- [ ] Criar telas acessíveis de autenticação.
- [ ] Criar fluxo de onboarding e perfil.
- [ ] Implementar pedido de exclusão com reautenticação.
- [ ] Implementar autorização offline local com validade máxima de 30 dias.

#### Testes primeiro

- [ ] Cadastro válido/inválido e e-mail duplicado sem enumeração.
- [ ] Conta não confirmada possui acesso restrito.
- [ ] Token expirado ou reutilizado é rejeitado.
- [ ] Senha nunca aparece em texto puro no banco/log.
- [ ] Reset revoga sessões conforme política.
- [ ] CSRF/origem inválida é bloqueada.
- [ ] Rate limit funciona.
- [ ] Usuário A não acessa perfil de B.
- [ ] Bloqueio administrativo impede novas sessões e não revela dados de saúde.
- [ ] Acesso local funciona dentro da validade offline e exige revalidação depois dela sem apagar a outbox.
- [ ] Fluxos web completos por E2E.

#### Critérios de saída

- Jornadas públicas e autenticadas verdes.
- Teste de isolamento horizontal verde.
- Conteúdo sensível ausente nos logs.

### Fase 4 — Fundação de sincronização local-first

**Status:** pendente

**Commit esperado:** `feat(phase-4): implement local-first sync foundation`

#### Tarefas

- [ ] Criar banco Dexie particionado por usuário.
- [ ] Modelar réplica local, outbox, cursor e metadados.
- [ ] Implementar transação local dado + operação.
- [ ] Implementar `/sync/push` com resultados por item.
- [ ] Implementar idempotência persistente.
- [ ] Implementar `change_log` e `/sync/pull` paginado.
- [ ] Implementar versão otimista e tombstones.
- [ ] Implementar máquina de estados de sincronização.
- [ ] Implementar reautenticação preservando outbox.
- [ ] Implementar limpeza/retenção de tombstones.
- [ ] Implementar UI base de pendências e conflito.

#### Testes primeiro

- [ ] Reload não perde mutação local.
- [ ] Mesmo push repetido não duplica registro.
- [ ] Queda após commit do servidor é recuperada idempotentemente.
- [ ] Operações fora de ordem são tratadas.
- [ ] Versão antiga gera conflito.
- [ ] Tombstone não ressuscita.
- [ ] Operação inválida não bloqueia o restante do lote.
- [ ] Usuários diferentes não compartilham IndexedDB lógico.
- [ ] Sessão expirada preserva e depois envia pendências.

#### Critérios de saída

- Harness de rede instável verde.
- Sincronização genérica pronta para entidades de domínio.
- Estado de sync observável e compreensível.

### Fase 5 — Exercícios, templates e planejamento

**Status:** pendente

**Commit esperado:** `feat(phase-5): implement workout planning`

#### Tarefas

- [ ] CRUD de exercícios do usuário.
- [ ] Catálogo inicial de flexão e agachamento.
- [ ] CRUD de planos e templates.
- [ ] Séries por repetições, duração e distância.
- [ ] Regras semanais e horários locais.
- [ ] Materializador de sessões futuras idempotente.
- [ ] Alteração com vigência futura.
- [ ] Sessões avulsas, reagendamento e cancelamento.
- [ ] Múltiplas sessões por data.
- [ ] UI mobile-first de planejamento.
- [ ] Sincronização offline das entidades da fase.

#### Testes primeiro

- [ ] Alterar template não muda sessão histórica.
- [ ] Materializar duas vezes não duplica.
- [ ] Alterar regra afeta somente futuro não iniciado.
- [ ] Segunda/sexta e fuso são calculados corretamente.
- [ ] Mais de uma sessão no dia é suportada.
- [ ] Dados de outro usuário permanecem inacessíveis.
- [ ] Jornada de planejar offline e sincronizar por E2E.

#### Critérios de saída

- Planejamento completo online e offline.
- Snapshots históricos comprovados por teste.

### Fase 6 — Tela Hoje e registros diários

**Status:** pendente

**Commit esperado:** `feat(phase-6): implement daily workout tracking`

#### Tarefas

- [ ] Dashboard da data atual no fuso do usuário.
- [ ] Execução por série e métrica.
- [ ] Conclusão total, parcial, interrupção e exercício ignorado.
- [ ] Salvamento incremental local.
- [ ] Caminhadas e detalhes.
- [ ] Relatos de dor com região, intensidade e momento.
- [ ] Confirmação explícita de ausência de dor articular.
- [ ] Definições e entradas de hábitos.
- [ ] Hábitos iniciais de café, arroz, proteína e salada.
- [ ] Peso e cintura.
- [ ] Observações por sessão/exercício/dor.
- [ ] Estados visuais de sincronização.
- [ ] Cadastro autenticado do histórico de 13/07/2026 pela interface/importação, nunca como seed global.

#### Testes primeiro

- [ ] Séries planejadas e reais são independentes.
- [ ] Série adicional não altera template.
- [ ] Parcialidade é calculada corretamente.
- [ ] Dor durante a série mantém o vínculo correto.
- [ ] Ausência não confirmada continua desconhecida.
- [ ] Um hábito/data respeita unicidade.
- [ ] Múltiplas medidas no dia são aceitas.
- [ ] Formulário sobrevive a reload offline.
- [ ] Jornada completa Hoje em viewport móvel.

#### Critérios de saída

- Registro diário funcional com e sem rede.
- Nenhum dado digitado se perde em reload testado.

### Fase 7 — Motor de progressão explicável

**Status:** pendente

**Commit esperado:** `feat(phase-7): implement explainable progression engine`

#### Tarefas

- [ ] Implementar framework versionado de regras puras.
- [ ] Implementar avaliação idempotente por evidência.
- [ ] Regra de duas sessões elegíveis e `+1` repetição/série.
- [ ] Regras de dor muscular leve, moderada e forte.
- [ ] Bloqueio de aumento por dor articular.
- [ ] Regra específica de dor pé/tornozelo durante agachamento.
- [ ] Regra de sessão perdida sem compensação.
- [ ] Limites configuráveis por exercício.
- [ ] Persistir evidências e explicação.
- [ ] Tela de sugestões, aceite, recusa e adiamento.
- [ ] Aceite cria mudança futura, sem alterar passado.
- [ ] Reavaliar/invalidar sugestão quando chega dor atrasada.
- [ ] Exibir avisos de segurança e persistir versão textual aplicável.

#### Testes primeiro

- [ ] Matriz completa de cada regra e intensidade.
- [ ] Dado ausente não é interpretado como ausência de dor.
- [ ] Duas sessões sem dor explícita geram uma única sugestão.
- [ ] Uma sessão com dor articular bloqueia aumento.
- [ ] Dor atrasada invalida sugestão ainda não aceita.
- [ ] Aceitar duas vezes é idempotente.
- [ ] Aceite afeta somente sessões futuras.
- [ ] Versão nova não altera avaliação histórica.
- [ ] Property-based tests para limites e não negatividade.

#### Critérios de saída

- Todas as regras da especificação estão implementadas e explicáveis.
- Nenhuma sugestão é aplicada sem ação explícita.
- Revisão manual de linguagem não diagnóstica concluída.

### Fase 8 — Calendário e edição histórica

**Status:** pendente

**Commit esperado:** `feat(phase-8): implement calendar and history`

#### Tarefas

- [ ] Calendário mensal responsivo.
- [ ] Badges separados para estado e tipo.
- [ ] Múltiplas sessões por data.
- [ ] Detalhe diário agregado.
- [ ] Edição de sessão, hábitos, medidas e dores.
- [ ] Filtros por tipo, estado e dor.
- [ ] Estado perdido derivado/confirmado.
- [ ] Tratamento correto de descanso e cancelamento.
- [ ] Indicador de pendência/conflito por dia.
- [ ] Sincronização offline e paginação histórica.

#### Testes primeiro

- [ ] Dia com caminhada e força mostra ambos.
- [ ] Descanso não vira perdido.
- [ ] Dia passado planejado segue regra de `missed`.
- [ ] Edição histórica não altera template.
- [ ] Filtros combinados são corretos.
- [ ] Navegação por calendário funciona offline.

#### Critérios de saída

- Histórico pesquisável e editável sem cor como único indicador.

### Fase 9 — Progresso, indicadores e gráficos

**Status:** pendente

**Commit esperado:** `feat(phase-9): implement progress analytics`

#### Tarefas

- [ ] Consultas/agregações de peso e cintura.
- [ ] Totais e evolução por exercício.
- [ ] Consistência semanal versionada.
- [ ] Caminhadas, distância e frequência.
- [ ] Treinos concluídos e parciais.
- [ ] Dor por tipo, intensidade e região.
- [ ] Filtros temporais.
- [ ] API paginada/agregada.
- [ ] Gráficos acessíveis com alternativa textual/tabular.
- [ ] Estados vazios e dados insuficientes.
- [ ] Cache local das últimas análises.

#### Testes primeiro

- [ ] Fórmulas com semanas vazias, parciais, descanso e cancelamento.
- [ ] Intervalos e limites de data inclusivos.
- [ ] Soma de repetições e caminhadas.
- [ ] Séries removidas/ignoradas não contaminam totais.
- [ ] Dor atrasada aparece no período correto.
- [ ] Gráficos possuem nomes e alternativa acessível.

#### Critérios de saída

- Todos os indicadores do `SPEC.md` disponíveis e explicados.
- Consultas dentro da meta de desempenho em dataset de referência.

### Fase 10 — Exportação, portabilidade e exclusão

**Status:** pendente

**Commit esperado:** `feat(phase-10): implement data portability and erasure`

#### Tarefas

- [ ] Definir e versionar schema do JSON.
- [ ] Exportar todas as entidades autorizadas.
- [ ] Gerar ZIP com CSVs normalizados.
- [ ] Documentar datas, unidades e relacionamentos no pacote.
- [ ] Incluir alterações locais pendentes quando solicitado.
- [ ] Excluir tokens e metadados internos.
- [ ] Implementar exclusão de conta e dados ativos.
- [ ] Documentar retenção inevitável de backups.
- [ ] Limpar réplica local após exclusão confirmada.

#### Testes primeiro

- [ ] Exportação round-trip estrutural.
- [ ] CSV preserva acentos e abre corretamente.
- [ ] Nenhum segredo/sessão aparece no pacote.
- [ ] Usuário não exporta outro usuário.
- [ ] Outbox pendente é marcada corretamente.
- [ ] Exclusão torna conta e dados inacessíveis.

#### Critérios de saída

- JSON e CSV validados por fixtures públicas sem dados reais.
- Fluxo de exclusão E2E verde.

### Fase 11 — PWA, iOS e acessibilidade

**Status:** pendente

**Commit esperado:** `feat(phase-11): harden pwa and mobile experience`

#### Tarefas

- [ ] Manifesto completo e ícones.
- [ ] App shell e cache versionado.
- [ ] Estratégias de cache por classe de recurso.
- [ ] Atualização segura do service worker.
- [ ] Fluxo de instalação para iOS, Android e desktop.
- [ ] Safe areas e teclado móvel.
- [ ] Estado standalone e retomada.
- [ ] Auditoria WCAG 2.2 AA.
- [ ] Navegação por teclado, foco e leitores de tela.
- [ ] Contraste, movimento reduzido e alvos de toque.
- [ ] Teste em iPhone e Android físicos.

#### Testes primeiro

- [ ] Manifesto e service worker falham auditoria antes da configuração.
- [ ] App shell carrega offline.
- [ ] Atualização não perde formulário/outbox.
- [ ] Testes automatizados de acessibilidade nas jornadas.
- [ ] Checklists manuais com aparelho, versão e evidência.

#### Critérios de saída

- Instalável nos três grupos de plataforma.
- Jornada Hoje funciona offline em iPhone físico.
- Sem violação automática crítica de acessibilidade.

### Fase 12 — Segurança, observabilidade e operação

**Status:** pendente

**Commit esperado:** `chore(phase-12): productionize security and operations`

#### Tarefas

- [ ] Produzir threat model.
- [ ] Revisar autorização de todos os endpoints.
- [ ] Configurar CSP, headers e proxy confiável.
- [ ] Redigir dados sensíveis dos logs.
- [ ] Criar métricas e alertas sem conteúdo pessoal.
- [ ] Implementar liveness/readiness.
- [ ] Configurar scans de dependência, imagem e segredo.
- [ ] Criar Dockerfiles de produção com usuário não root.
- [ ] Configurar serviços no Coolify.
- [ ] Configurar PostgreSQL privado e usuário mínimo.
- [ ] Configurar backup externo e retenção.
- [ ] Executar e documentar restauração.
- [ ] Criar runbooks de deploy, rollback, incidente e recuperação.
- [ ] Publicar aviso de privacidade e termos aplicáveis.
- [ ] Preparar SMTP, domínio e DNS de produção.

#### Testes primeiro

- [ ] Testes negativos de autorização para todos os recursos.
- [ ] Verificação de headers e cookies.
- [ ] Scanner detecta fixture insegura antes da correção.
- [ ] Readiness falha quando dependência essencial está indisponível.
- [ ] Teste de carga nominal e abuso de autenticação.
- [ ] Exercício de restauração mede RPO/RTO.

#### Critérios de saída

- Nenhum achado crítico/alto sem mitigação aprovada.
- Backup restaurado em ambiente isolado.
- Coolify executa containers saudáveis sob HTTPS.

### Fase 13 — Validação integral e lançamento

**Status:** pendente

**Commit esperado:** `release(phase-13): validate public launch`

#### Tarefas

- [ ] Executar suíte completa em ambiente limpo.
- [ ] Executar E2E online, offline e reconexão.
- [ ] Executar testes multiusuário e dois dispositivos.
- [ ] Validar conflito real entre dispositivos.
- [ ] Validar todas as regras de progressão.
- [ ] Validar exportação e exclusão.
- [ ] Testar upgrade de versão anterior e rollback de aplicação.
- [ ] Fazer auditoria manual de privacidade e linguagem de saúde.
- [ ] Fazer teste exploratório em iOS, Android e desktop.
- [ ] Corrigir achados por TDD.
- [ ] Congelar schema/contratos da versão 1.0.
- [ ] Criar release notes e checklist de abertura pública.

#### Testes primeiro

- [ ] Criar checklist executável de aceite baseado na seção 17 do `SPEC.md`.
- [ ] Registrar falhas encontradas antes de correções.
- [ ] Reexecutar toda a suíte após cada correção de release.

#### Critérios de saída

- Todos os critérios de aceite do produto satisfeitos.
- Histórico completo e nenhum bloqueador conhecido.
- Release versionada e deploy de produção validado.

## 5. Dependências entre fases

```text
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13
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
