# Torkout — Plano de Implementação

**Base:** `SPEC.md` versão 1.0

**Método obrigatório:** TDD Red → Green → Refactor

**Unidade de entrega:** fase completa com commit de encerramento

**Status geral:** Fases 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 e 10 concluídas; Fase 11 ainda não iniciada

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
