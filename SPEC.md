# Torkout — Especificação do Produto e da Arquitetura

**Versão:** 1.1

**Data:** 14/07/2026

**Status:** Aprovada para planejamento de implementação

**Idioma da aplicação:** Português do Brasil (`pt-BR`)

## 1. Visão do produto

Torkout é uma aplicação web progressiva para planejar, registrar e acompanhar treinos, caminhadas, medidas corporais, hábitos alimentares e ocorrências de dor. A aplicação deve privilegiar registro rápido no celular, funcionar com conexão instável, aceitar registros offline e sincronizá-los posteriormente.

O produto atende múltiplos usuários, mas cada usuário vê e manipula somente seus próprios dados. Os dados de treino e saúde são privados por padrão e não existe compartilhamento social nesta versão da especificação.

O sistema auxilia a consistência e a progressão de treino, sem diagnosticar condições e sem substituir orientação médica, fisioterapêutica, nutricional ou de educação física.

## 2. Objetivos

- Tornar o registro diário simples o suficiente para ser mantido por longo prazo.
- Separar claramente o que foi planejado do que foi realmente executado.
- Preservar o histórico mesmo quando o plano futuro for alterado.
- Oferecer visão de evolução de treino, consistência, peso, cintura e dores.
- Sugerir progressões conservadoras, explicáveis e opcionais.
- Permitir funcionamento offline em aparelhos previamente autenticados.
- Manter os dados sob controle da própria infraestrutura do projeto.
- Nascer preparado para múltiplos usuários e cadastro público.
- Permitir exportação e exclusão dos dados do titular.

## 3. Fora de escopo

- Diagnóstico, prescrição clínica ou recomendação médica.
- Atendimento de emergência.
- Rede social, ranking ou competição entre usuários.
- Marketplace de treinadores ou nutricionistas.
- Contagem rigorosa de calorias e macronutrientes.
- Pagamentos e assinaturas.
- Integração com Apple Health, Health Connect ou wearables.
- Compartilhamento de dados com profissionais ou terceiros.
- Aplicativos nativos publicados em lojas.

Esses itens somente entram no produto mediante revisão desta especificação.

## 4. Decisões aprovadas

1. O cadastro será aberto a outras pessoas.
2. Um aparelho previamente autenticado poderá consultar e alterar dados locais offline.
3. Sugestões automáticas de progressão fazem parte do produto inicial.
4. Toda sugestão é opcional; nenhuma progressão altera o plano sem aceite explícito.
5. A solução será auto-hospedada no Coolify.
6. O servidor PostgreSQL será a fonte de verdade após a sincronização.
7. A experiência local será otimista: primeiro grava no IndexedDB, depois sincroniza.
8. Estados de execução e tipos de atividade serão dimensões distintas.
9. Alterações no planejamento recorrente afetam somente o futuro.
10. Instantes são persistidos em UTC, enquanto datas civis e horários recorrentes preservam o fuso do usuário.

## 5. Stack técnica

### 5.1 Frontend

- React.
- Vite.
- TypeScript com modo estrito.
- React Router.
- TanStack Query para estado remoto.
- Dexie sobre IndexedDB para réplica local e outbox.
- React Hook Form.
- Zod para contratos e formulários.
- Recharts para gráficos.
- `vite-plugin-pwa` e Workbox para manifesto, service worker e cache do app shell.
- CSS mobile-first; a biblioteca visual deverá respeitar acessibilidade e não poderá impedir customização.

### 5.2 Backend

- Node.js em versão LTS suportada.
- Fastify.
- Zod e geração de OpenAPI.
- Drizzle ORM.
- Migrações SQL geradas, revisadas e versionadas.
- Better Auth.
- Argon2id para hash de senha.
- Pino para logs JSON estruturados.

### 5.3 Infraestrutura

- PostgreSQL em rede privada.
- Containers Docker.
- Deploy pelo Coolify.
- Frontend e API apresentados sob a mesma origem pública sempre que possível.
- HTTPS obrigatório.
- Backups externos em armazenamento compatível com S3.
- Health checks e readiness checks.

### 5.4 Estrutura de repositório prevista

```text
apps/
  api/
  web/
packages/
  contracts/
  database/
  domain/
  test-utils/
infra/
docs/
```

O projeto será um monorepo gerenciado por `pnpm`. A estrutura poderá ser simplificada enquanto houver pouco código, desde que contratos, domínio e infraestrutura permaneçam desacoplados.

## 6. Perfis e autorização

### 6.1 Visitante

- Criar conta.
- Confirmar e-mail.
- Entrar.
- Solicitar recuperação de senha.
- Consultar documentos públicos de privacidade e termos.

### 6.2 Usuário autenticado

- Gerenciar somente o próprio perfil e dados.
- Planejar, registrar, editar, exportar e excluir seus dados.
- Consultar e decidir sobre sugestões de progressão.
- Revogar outras sessões autenticadas.
- Solicitar exclusão integral da conta.

### 6.3 Administrador operacional

- Consultar saúde técnica do sistema e métricas agregadas sem conteúdo de saúde.
- Bloquear contas em caso de abuso.
- Nunca consultar dados de saúde pela interface administrativa comum.
- Acesso excepcional ao banco deve ser auditado e seguir privilégio mínimo.

## 7. Requisitos funcionais

### 7.1 Autenticação e conta

**AUTH-001 — Cadastro:** permitir cadastro com nome, e-mail e senha.

**AUTH-002 — Verificação:** exigir confirmação de e-mail antes do uso completo.

**AUTH-003 — Sessão:** manter sessão revogável em cookie `HttpOnly`, `Secure` e `SameSite=Lax`.

**AUTH-004 — Recuperação:** permitir redefinição por link de uso único e expiração curta.

**AUTH-005 — Proteção:** aplicar rate limit em cadastro, login, confirmação e recuperação.

**AUTH-006 — Privacidade:** registrar versão e data do aceite dos documentos aplicáveis.

**AUTH-007 — Sessões:** listar e revogar sessões do usuário.

**AUTH-008 — Exclusão:** permitir exclusão da conta com reautenticação e confirmação explícita.

**AUTH-009 — Abuso:** permitir CAPTCHA adaptativo ou bloqueio temporário quando limites forem excedidos.

**AUTH-010 — Acesso offline:** permitir acesso local por até 30 dias desde a última autenticação online bem-sucedida; após esse prazo, preservar os dados e exigir conexão para revalidar a identidade.

### 7.2 Onboarding e perfil

**PROFILE-001:** cadastrar nome de exibição, altura, fuso horário e idioma.

**PROFILE-002:** aceitar peso e cintura iniciais opcionalmente.

**PROFILE-003:** explicar o caráter não médico das sugestões.

**PROFILE-004:** permitir configurar horário preferencial de treino.

**PROFILE-005:** permitir ativar/desativar hábitos iniciais.

**PROFILE-006:** permitir escolher a escala de unidades, inicialmente métrica.

### 7.3 Exercícios

**EXERCISE-001:** disponibilizar catálogo inicial com flexão e agachamento livre.

**EXERCISE-002:** permitir exercícios personalizados.

**EXERCISE-003:** classificar acompanhamento por repetições, duração ou distância.

**EXERCISE-004:** desativar exercício sem remover o histórico.

**EXERCISE-005:** armazenar instrução curta opcional, sem apresentá-la como orientação clínica.

### 7.4 Planejamento

**PLAN-001:** criar planos com nome, vigência e estado.

**PLAN-002:** criar templates de força, caminhada e descanso.

**PLAN-003:** configurar exercícios, ordem, séries, repetições, duração ou distância.

**PLAN-004:** associar templates a dias da semana e horários locais.

**PLAN-005:** permitir mais de uma sessão no mesmo dia.

**PLAN-006:** materializar sessões futuras em janela configurável.

**PLAN-007:** alterações recorrentes afetam somente sessões futuras não iniciadas.

**PLAN-008:** preservar snapshot do planejamento em cada sessão.

**PLAN-009:** permitir sessão avulsa.

**PLAN-010:** permitir reagendar, cancelar ou marcar descanso.

**PLAN-011:** treino perdido não será automaticamente acumulado ou dobrado.

**PLAN-012:** aceitar progressões futuras manuais por data de vigência.

**PLAN-013:** o editor de template deve permitir vários exercícios no mesmo treino, com ordem,
quantidade de séries e alvo próprios por exercício.

**PLAN-014:** caminhada deve ser cadastrada como uma atividade única, com distância e duração
planejadas, sem reutilizar artificialmente o conceito de três séries.

**PLAN-015:** permitir definir início e fim da vigência, inclusive em datas passadas, e
materializar localmente as sessões da janela escolhida antes da sincronização.

**PLAN-016:** permitir cadastrar sessões avulsas completas em qualquer data civil, inclusive
retroativa, com tipo, exercícios, séries, horário, caminhada e observações.

**PLAN-017:** permitir cadastrar descanso e recuperação como tipos explícitos, inclusive aos
domingos, usando numeração ISO de segunda `1` a domingo `7`.

### 7.5 Tela Hoje

**TODAY-001:** mostrar data civil atual no fuso do usuário.

**TODAY-002:** mostrar sessões planejadas, tipo, horário e estado de sincronização.

**TODAY-003:** mostrar exercícios e metas por série.

**TODAY-004:** permitir registrar repetições, duração ou distância realizada.

**TODAY-005:** permitir concluir, concluir parcialmente, ignorar exercício ou interrompê-lo.

**TODAY-006:** permitir registrar observações da sessão e do exercício.

**TODAY-007:** solicitar confirmação explícita sobre ocorrência ou ausência de dor articular.

**TODAY-008:** registrar dor muscular e articular.

**TODAY-009:** mostrar hábitos do dia.

**TODAY-010:** permitir peso e cintura sem tornar o preenchimento diário obrigatório.

**TODAY-011:** gravar cada edição localmente sem exigir conclusão da sessão.

**TODAY-012:** mostrar mensagens distintas para salvo localmente, pendente, sincronizando, sincronizado e conflito.

### 7.6 Sessões, séries e caminhadas

**WORKOUT-001:** estados da sessão: `planned`, `in_progress`, `completed`, `partial`, `missed`, `cancelled`.

**WORKOUT-002:** tipos: `strength`, `walk`, `rest` e `other`.

**WORKOUT-003:** uma sessão de descanso não exige execução.

**WORKOUT-004:** estado `missed` é derivado ou confirmado após o encerramento da data local.

**WORKOUT-005:** registrar início e conclusão reais quando informados.

**WORKOUT-006:** armazenar alvo e realizado em cada série.

**WORKOUT-007:** permitir adicionar ou remover séries durante a execução sem alterar o template original.

**WORKOUT-008:** caminhada registra distância, duração e observação; GPS não é obrigatório.

**WORKOUT-009:** calcular volume simples por exercício baseado na métrica aplicável.

### 7.7 Dor

**PAIN-001:** tipos: muscular e articular.

**PAIN-002:** intensidade: não informada, leve, moderada e forte.

**PAIN-003:** momento: antes, durante, imediatamente depois ou dia seguinte.

**PAIN-004:** região corporal controlada com opção “outra”.

**PAIN-005:** associação opcional com sessão, exercício e série.

**PAIN-006:** registrar se o exercício foi interrompido.

**PAIN-007:** permitir observação livre.

**PAIN-008:** dor articular durante exercício gera alerta conservador para interromper e registrar.

**PAIN-009:** o sistema não diagnostica causa nem recomenda tratamento.

**PAIN-010:** ausência de registro não equivale a ausência de dor para o motor de progressão.

### 7.8 Hábitos e alimentação

**HABIT-001:** definições de hábito suportam booleano, quantidade, escala e escolha.

**HABIT-002:** criar hábitos iniciais para café/açúcar, arroz, proteína e salada.

**HABIT-003:** sugestões de configuração inicial:

- Café: não consumido, sem açúcar ou com açúcar.
- Arroz: não consumido, reduzido, habitual ou aumentado.
- Proteína: não, quantidade simples ou porções, conforme configuração.
- Salada: não, sim ou porções, conforme configuração.

**HABIT-004:** permitir hábitos personalizados.

**HABIT-005:** desativar hábito preservando histórico.

**HABIT-006:** permitir no máximo um registro por hábito e data local, com edição posterior.

**HABIT-007:** não calcular calorias sem entrada explícita de uma futura funcionalidade.

### 7.9 Medidas corporais

**BODY-001:** registrar peso em quilogramas.

**BODY-002:** registrar cintura em centímetros.

**BODY-003:** aceitar peso e cintura juntos ou separadamente.

**BODY-004:** aceitar múltiplas medições na mesma data.

**BODY-005:** registrar instante, data local e observação.

**BODY-006:** validar faixas plausíveis sem impedir casos legítimos; valores fora da faixa comum exigem confirmação.

**BODY-007:** permitir registrar, além de peso e cintura, circunferências de abdômen/barriga,
bíceps, coxa, quadril/glúteos, pescoço, peito, panturrilha e outras regiões personalizadas.

**BODY-008:** cada medição adicional preserva nome, unidade e valor no snapshot histórico; nomes
personalizados não alteram registros anteriores.

**BODY-009:** permitir escolher a data civil da medição para lançamento retroativo.

**BODY-010:** uma medição pode conter qualquer combinação não vazia de peso, cintura e medidas
adicionais, sem tornar peso ou cintura obrigatórios.

### 7.10 Calendário e histórico

**CAL-001:** exibir mês e navegação por data.

**CAL-002:** mostrar separadamente estado e tipos de atividade.

**CAL-003:** permitir múltiplos badges por dia.

**CAL-004:** selecionar dia para visualizar e editar sessões, hábitos, dores e medidas.

**CAL-005:** diferenciar registro sincronizado de pendente.

**CAL-006:** não transformar automaticamente um descanso em treino perdido.

**CAL-007:** filtros por atividade, estado e presença de dor.

### 7.11 Progresso

**PROGRESS-001:** gráfico de peso.

**PROGRESS-002:** gráfico de cintura.

**PROGRESS-003:** total de flexões e agachamentos por período.

**PROGRESS-004:** sessões concluídas e parciais.

**PROGRESS-005:** consistência semanal.

**PROGRESS-006:** caminhadas, distância e frequência.

**PROGRESS-007:** evolução de repetições por exercício.

**PROGRESS-008:** frequência de dor muscular e articular por intensidade e região.

**PROGRESS-009:** filtros de 4, 8 e 12 semanas e intervalo personalizado.

**PROGRESS-010:** indicadores devem informar fórmula e período.

**PROGRESS-011:** semanas usam a preferência do usuário, inicialmente segunda a domingo.

Consistência semanal será calculada como sessões concluídas equivalentes divididas pelas sessões planejadas executáveis: concluída vale `1`, parcial vale `0,5`, perdida vale `0`; descanso e cancelamento justificado não entram no denominador. A fórmula deve ser alterável apenas mediante versionamento.

### 7.12 Motor de progressão

**PROG-001:** executar após sincronização de uma sessão concluída ou parcial e após novo relato de dor relacionado.

**PROG-002:** cada sugestão armazena código, versão da regra, evidências, resultado, explicação e validade.

**PROG-003:** usuário pode aceitar, ignorar ou adiar.

**PROG-004:** aceitar cria uma alteração futura explícita; nunca reescreve histórico.

**PROG-005:** sugestões repetidas para a mesma evidência são idempotentes.

**PROG-006:** duas sessões elegíveis consecutivas do exercício, atingindo a meta e com confirmação explícita de ausência de dor articular, sugerem `+1` repetição por série.

**PROG-007:** dor muscular leve sugere manutenção.

**PROG-008:** dor muscular moderada impede aumento e oferece manutenção ou pequena redução de volume.

**PROG-009:** dor muscular forte impede aumento e sugere recuperação/avaliação profissional em linguagem não diagnóstica.

**PROG-010:** qualquer dor articular ligada à sessão ou exercício impede aumento.

**PROG-011:** dor articular durante agachamento, inclusive em pé/tornozelo, sugere interromper o exercício e registrar o ocorrido.

**PROG-012:** sessão perdida mantém o planejamento seguinte, sem compensação automática.

**PROG-013:** dados de dor ausentes tornam a sessão inelegível para regra que exige ausência de dor.

**PROG-014:** regras possuem limites configuráveis por exercício; a aplicação não sugere crescimento ilimitado.

**PROG-015:** mudanças de regra não alteram sugestões históricas.

**PROG-016:** toda tela de sugestão contém aviso de que não substitui profissional.

Para redução moderada, o algoritmo propõe a menor destas mudanças: remover uma série ou reduzir aproximadamente 10% das repetições, nunca abaixo de uma configuração mínima. A escolha continua sendo do usuário.

### 7.13 Offline e sincronização

**SYNC-001:** armazenar localmente dados necessários às telas principais.

**SYNC-002:** toda mutação local gera operação de outbox na mesma transação IndexedDB.

**SYNC-003:** UUIDs são gerados no cliente.

**SYNC-004:** cada operação possui identificador idempotente.

**SYNC-005:** sincronizar ao abrir, retomar, recuperar conexão, salvar enquanto online e por ação manual.

**SYNC-006:** não depender de Background Sync.

**SYNC-007:** servidor usa versão inteira monotônica por registro.

**SYNC-008:** atualização envia `baseVersion`.

**SYNC-009:** conflito não pode ser silenciosamente sobrescrito.

**SYNC-010:** exclusões usam tombstone até expiração segura.

**SYNC-011:** pull incremental usa cursor opaco do servidor.

**SYNC-012:** autenticação expirada mantém alterações locais; o envio aguarda nova autenticação.

**SYNC-013:** interface permite inspecionar, repetir e exportar alterações pendentes.

**SYNC-014:** operação malformada não bloqueia indefinidamente outras operações válidas do lote.

**SYNC-015:** conflitos exibem versão local, versão do servidor e ação de resolução.

**SYNC-016:** dados offline de um usuário não aparecem para outro usuário no mesmo navegador.

**SYNC-017:** logout oferece remover dados locais ou mantê-los protegidos para novo login da mesma conta.

**SYNC-018:** exclusão de conta remove a réplica local após confirmação do servidor.

Política inicial de tombstone: retenção mínima de 90 dias, revisável conforme telemetria de dispositivos inativos.

### 7.14 Exportação e direitos do titular

**EXPORT-001:** JSON contém versão do formato, fuso e todas as entidades do usuário.

**EXPORT-002:** CSV é entregue em ZIP com arquivos normalizados e UTF-8 com BOM quando necessário para compatibilidade.

**EXPORT-003:** datas e unidades são documentadas no pacote.

**EXPORT-004:** exportação nunca contém hashes, sessões, tokens ou metadados internos de segurança.

**EXPORT-005:** permitir exportação mesmo quando existirem alterações locais pendentes, marcando a origem.

**EXPORT-006:** exclusão de conta informa prazo e abrangência dos backups.

**EXPORT-007:** permitir correção de dados pela própria interface.

### 7.15 PWA

**PWA-001:** manifesto com nome, nome curto, ícones, cores, `id`, `start_url` e `display: standalone`.

**PWA-002:** app shell disponível offline após primeira carga bem-sucedida.

**PWA-003:** instruções específicas para instalação no iOS.

**PWA-004:** atualização do service worker não interrompe formulário em andamento.

**PWA-005:** recursos estáticos usam cache versionado.

**PWA-006:** dados de saúde autenticados não usam Cache Storage como banco; usam IndexedDB.

**PWA-007:** suportar safe areas, teclado móvel, orientação e modo standalone.

**PWA-008:** mostrar versão instalada e permitir recarregar atualização disponível.

## 8. Modelo de dados

Todas as tabelas de domínio incluem `id uuid`, `user_id uuid` quando aplicável, `created_at timestamptz`, `updated_at timestamptz`, `version integer` e `deleted_at timestamptz nullable`, salvo justificativa registrada em decisão arquitetural.

### 8.1 Identidade e privacidade

- `users`: identidade principal do Better Auth.
- `accounts`: credenciais e provedores.
- `sessions`: sessões revogáveis.
- `verifications`: confirmação e recuperação.
- `user_profiles`: altura, fuso IANA, idioma, semana inicial e preferências.
- `privacy_documents`: tipo, versão, hash e vigência.
- `privacy_acceptances`: usuário, documento, instante, IP reduzido/necessário e user agent minimizado.

### 8.2 Catálogo e planejamento

- `exercises`: nome, categoria, métrica, sistema/customizado e estado.
- `training_plans`: nome, vigência e estado.
- `workout_templates`: plano, nome e tipo.
- `workout_template_exercises`: exercício, ordem e observação.
- `workout_template_sets`: série, alvo de repetição/duração/distância.
- `schedule_rules`: template, dia da semana, hora local, fuso e vigência.

### 8.3 Execução

- `workout_sessions`: data planejada, horário sugerido, tipo, estado, origem, início, fim e observação.
- `session_exercises`: snapshot de nome/métrica, ordem, estado e observação.
- `exercise_sets`: número, alvos e valores reais.
- `walking_details`: distância planejada/real, duração e origem da medição.
- `pain_reports`: tipo, intensidade, região, momento, observação e vínculos opcionais.

### 8.4 Hábitos e corpo

- `habit_definitions`: nome, tipo, unidade, ordem e estado.
- `habit_options`: rótulo, valor estável e ordem.
- `habit_entries`: data local e exatamente um valor booleano, numérico, textual ou opção.
- `body_measurements`: instante, data local, peso, cintura, medidas adicionais estruturadas e
  observação.

### 8.5 Progressão

- `progression_rule_versions`: código, versão, parâmetros e vigência.
- `progression_evaluations`: regra, exercício, evidências imutáveis e resultado.
- `progression_suggestions`: alteração proposta, explicação, estado e validade.
- `progression_decisions`: aceite, recusa ou adiamento, instante e efeito criado.

### 8.6 Sincronização e operação

- `sync_operations`: usuário, dispositivo, operação idempotente, entidade, resultado e instante.
- `change_log`: sequência/cursor, entidade, versão, operação e tombstone.
- `registered_devices`: identificador pseudônimo, última sincronização e plataforma aproximada.
- `audit_events`: somente eventos de segurança e privacidade; não armazenar conteúdo de saúde.

### 8.7 Restrições essenciais

- E-mail normalizado único.
- Toda consulta de domínio deve incluir o usuário autenticado.
- Um hábito possui no máximo uma entrada por usuário/data, salvo mudança explícita de requisito.
- Número de série é único dentro do exercício da sessão.
- Ordem de exercício é única dentro do template ou sessão.
- Valores reais não podem ser negativos.
- Pelo menos peso, cintura ou uma medida adicional deve existir em uma medição.
- Relatos de dor exigem tipo e momento.
- Aceite de sugestão é idempotente.
- `version` aumenta em toda mutação sincronizável.

## 9. Estratégia de datas e tempo

- Instantes reais usam `timestamptz` e são enviados como ISO 8601 em UTC.
- Datas civis usam `date`.
- Horários recorrentes usam hora local e fuso IANA.
- O fuso inicial recomendado é `America/Cuiaba`.
- Alterar o fuso do perfil não muda a data civil histórica já registrada.
- Sessões planejadas preservam o fuso usado na materialização.
- Cálculos semanais usam a preferência de início da semana do usuário.
- Testes devem cobrir meia-noite, mudança de fuso e horário de verão, ainda que o fuso inicial não o observe.

## 10. API

Base pública: `/api/v1`.

### 10.1 Princípios

- JSON em UTF-8.
- Validação de entrada e saída.
- Erros no formato Problem Details ou envelope equivalente documentado.
- Paginação por cursor para históricos.
- Idempotency key em mutações apropriadas.
- Concorrência otimista com versão.
- OpenAPI gerado e testado.
- Endpoints nunca aceitam `user_id` como autorização; o usuário vem da sessão.

### 10.2 Grupos previstos

- `/auth/*`: endpoints do Better Auth.
- `/api/v1/profile`.
- `/api/v1/exercises`.
- `/api/v1/plans`.
- `/api/v1/templates`.
- `/api/v1/sessions`.
- `/api/v1/pain-reports`.
- `/api/v1/habits`.
- `/api/v1/measurements`.
- `/api/v1/progression/suggestions`.
- `/api/v1/progress`.
- `/api/v1/sync/push`.
- `/api/v1/sync/pull`.
- `/api/v1/exports`.
- `/api/v1/account`.
- `/health/live` e `/health/ready`.

Contratos detalhados serão derivados dos requisitos e versionados no pacote `contracts` antes de cada implementação.

## 11. Sincronização: protocolo

### 11.1 Push

O cliente envia lote ordenado contendo:

- `operationId`.
- `deviceId` pseudônimo.
- `entityType`.
- `entityId`.
- `operation`: create, update ou delete.
- `baseVersion`.
- `clientOccurredAt`.
- payload validado.

O servidor responde individualmente com aplicado, duplicado, rejeitado, não autorizado ou conflito, incluindo a versão corrente quando seguro.

### 11.2 Pull

O cliente envia cursor opaco e recebe:

- alterações posteriores autorizadas;
- tombstones;
- novo cursor;
- indicador de mais páginas;
- horário do servidor.

### 11.3 Conflitos

- Criações duplicadas com o mesmo `operationId` são idempotentes.
- Atualização com versão antiga gera conflito.
- Campos diferentes podem ser mesclados somente por regra determinística testada.
- Mesma propriedade alterada exige decisão do usuário.
- Exclusão concorrente nunca é revertida silenciosamente.
- Resolução gera nova operação auditável.

## 12. Segurança e privacidade

- Senhas com Argon2id e salt individual.
- Segredos somente em variáveis de ambiente/secret store do Coolify.
- TLS obrigatório.
- Cookies seguros e HttpOnly.
- CSRF, validação de origem e CORS restrito.
- CSP progressivamente restritiva e sem scripts inline não autorizados.
- Proteção contra XSS, injeção, enumeração de contas e força bruta.
- PostgreSQL sem porta pública.
- Usuário de banco da API sem privilégios administrativos.
- Logs sem corpo de requisição, token, cookie, senha, notas, dor ou medidas.
- Redação de cabeçalhos sensíveis.
- Dependências verificadas automaticamente.
- Backups criptografados em trânsito e no destino.
- Restauração testada.
- Coleta mínima de IP e user agent.
- Exportação e exclusão do titular.
- Aviso de privacidade versionado e aceite específico para dados de saúde.
- Procedimento de incidente documentado antes da abertura pública.

Criptografia de campos individuais no PostgreSQL não é requisito inicial, pois chaves disponíveis à própria API não protegem contra comprometimento completo dela. A decisão poderá ser revista por threat model. Criptografia de disco/volume e de backups é obrigatória.

## 13. Requisitos não funcionais

### 13.1 Compatibilidade

- Safari/iOS nas duas versões principais suportadas pela Apple no momento do release.
- Chrome/Android atual e anterior.
- Chrome, Edge, Firefox e Safari desktop atuais.
- Teste obrigatório em iPhone físico.

### 13.2 Desempenho

- App shell reutilizável após primeira visita.
- Interação local de registro percebida como imediata, meta inferior a 100 ms.
- API p95 inferior a 500 ms nas operações comuns sob carga nominal.
- Tela Hoje funcional em rede lenta após autenticação inicial.
- Gráficos paginados/agregados para não carregar histórico ilimitado.

### 13.3 Acessibilidade

- Alvo WCAG 2.2 nível AA.
- Navegação por teclado.
- Rótulos e mensagens de erro associados aos campos.
- Estados não diferenciados somente por cor.
- Áreas de toque adequadas.
- Respeito a redução de movimento e contraste.

### 13.4 Confiabilidade

- Nenhuma mutação local pode desaparecer ao atualizar a página.
- Repetição de push não duplica dados.
- Migrações possuem plano de rollback ou forward fix documentado.
- Deploy só recebe tráfego após readiness positivo.
- RPO inicial: 24 horas.
- RTO inicial: 4 horas.

### 13.5 Observabilidade

- Logs JSON com request ID.
- Métricas de latência, erros, autenticação, tamanho de outbox e falhas de sync, sem conteúdo pessoal.
- Alertas de indisponibilidade e falha de backup.
- Endpoint de liveness sem dependências e readiness verificando dependências essenciais.

## 14. Estratégia de testes

Todo comportamento será implementado em TDD conforme `CLAUDE.md`.

- Testes unitários para regras de domínio e progressão.
- Testes de contrato para validação e OpenAPI.
- Testes de integração com PostgreSQL real efêmero.
- Testes de componente para formulários e estados.
- Testes E2E para jornadas críticas.
- Testes de sincronização com quedas de rede, repetição, reordenação e conflitos.
- Testes de migração para banco vazio e banco com versão anterior.
- Testes de segurança para autorização horizontal.
- Testes de acessibilidade automatizados e verificação manual.
- Testes manuais em iPhone para instalação, retomada, teclado e offline.

Cobertura é indicador, não objetivo isolado. Regras de progressão, autorização, sincronização e cálculos exigem cobertura de ramos e casos limítrofes.

## 15. Dados iniciais

O catálogo terá apenas exercícios genéricos do sistema. Contas novas começam sem plano, sessões,
medidas ou histórico pessoal. A aplicação não inclui importação dedicada a uma pessoa ou data.

Todo plano e todo lançamento retroativo são criados explicitamente pelo usuário pelos mesmos
formulários disponíveis às demais contas.

## 16. Implantação e backup

- Ambientes separados: desenvolvimento, teste e produção.
- Imagens reproduzíveis e fixadas por versão.
- Migração executada uma vez antes de liberar a API nova.
- Frontend, API e PostgreSQL em recursos separados no Coolify.
- PostgreSQL apenas em rede privada.
- Backup diário externo.
- Retenção inicial: 7 diários, 5 semanais e 12 mensais.
- Teste trimestral de restauração.
- Backup extraordinário antes de migrações destrutivas.
- Rollback de aplicação não pode depender de reverter migração destrutiva.

## 17. Critérios de aceite do produto

O produto é considerado pronto para abertura pública quando:

1. Todas as fases obrigatórias do `PLAN.md` estiverem concluídas e registradas.
2. Cadastro, confirmação, recuperação e exclusão de conta funcionarem.
3. Um usuário não conseguir acessar dados de outro em testes automatizados.
4. Planejamento, Hoje, calendário, progresso, hábitos, dor e medidas funcionarem online e offline conforme definido.
5. Sincronização resistir a repetição e conexão interrompida sem duplicar ou perder dados.
6. Conflitos forem detectados e resolvidos explicitamente.
7. Sugestões de progressão forem explicáveis, opcionais e versionadas.
8. Exportações JSON e CSV forem válidas.
9. PWA for instalável e testada em iPhone, Android e desktop.
10. Backup externo e restauração tiverem evidência registrada.
11. Threat model, aviso de privacidade e procedimento de incidente estiverem documentados.
12. Não houver vulnerabilidade crítica ou alta conhecida sem mitigação aprovada.

## 18. Gestão de mudanças

- Mudança funcional exige atualização deste arquivo antes ou junto da implementação.
- Decisão arquitetural relevante exige ADR em `docs/adr/`.
- Mudança de regra de progressão cria nova versão; nunca altera a versão histórica.
- Mudança de fórmula analítica deve preservar a versão anterior ou documentar recálculo.
- Desvios e descobertas de implementação são registrados no `HISTORY.md`.
- O `PLAN.md` é a fonte de verdade do andamento; este arquivo é a fonte de verdade do comportamento esperado.
