# Instruções de Engenharia — Torkout

Estas regras são obrigatórias para qualquer pessoa ou agente que trabalhe neste repositório.

## 1. Leitura obrigatória

Antes de alterar o projeto:

1. Ler `SPEC.md` integralmente.
2. Ler `PLAN.md` e identificar a fase/tarefa ativa.
3. Ler as entradas relevantes de `HISTORY.md`.
4. Ler ADRs relacionados.
5. Verificar `git status` e preservar alterações alheias.

Se o trabalho não estiver coberto pela especificação ou pelo plano, atualizar os documentos antes da implementação. Não inventar escopo silenciosamente.

## 2. TDD obrigatório: Red → Green → Refactor

Toda implementação de comportamento, correção ou alteração observável deve seguir esta sequência:

### RED

1. Criar primeiro o menor teste que descreva o comportamento esperado.
2. Executar o teste.
3. Confirmar que ele falha pela ausência ou incorreção do comportamento pretendido.
4. Se falhar por import quebrado, ambiente indisponível ou erro do próprio teste, corrigir o teste/ambiente e repetir até obter a falha comportamental correta.
5. Registrar evidência resumida no `HISTORY.md` da fase.

### GREEN

1. Implementar somente o necessário para satisfazer o teste.
2. Executar o teste alvo.
3. Confirmar sucesso.
4. Executar testes diretamente relacionados.
5. Não enfraquecer assertivas, alterar expectativas corretas ou inserir bypass apenas para obter verde.

### REFACTOR

1. Melhorar nomes, estrutura, duplicação e limites arquiteturais sem mudar comportamento.
2. Reexecutar testes alvo e regressões relevantes.
3. Executar typecheck, lint e formatação.
4. Registrar resultados no fechamento da fase.

É proibido escrever a implementação primeiro e adicionar teste depois.

## 3. Como aplicar TDD por tipo de mudança

- **Regra de domínio:** teste unitário puro primeiro.
- **API:** teste de contrato/integração primeiro, incluindo autorização e erro.
- **Banco/migração:** teste de schema ou migração contra PostgreSQL real primeiro.
- **UI:** teste de componente ou E2E do comportamento primeiro.
- **Sincronização:** teste determinístico com repetição, queda ou conflito primeiro.
- **Segurança:** teste negativo/exploit controlado primeiro.
- **Configuração:** criar verificação automatizada que falhe antes da configuração.
- **Documentação não executável:** executar lint, links e consistência; correções puramente textuais não exigem teste unitário, mas exigem verificação documental.

Cada bug deve ganhar um teste de regressão que falhe antes da correção.

## 4. Regras de testes

- Não usar `.skip`, `.only`, retries ou snapshots atualizados para esconder falha.
- Não mockar a regra que está sendo testada.
- Preferir PostgreSQL real efêmero em testes de persistência.
- Controlar relógio, UUID e rede de modo determinístico.
- Cobrir sucesso, validação, autorização, concorrência e falha relevante.
- Testar isolamento: usuário A nunca acessa dados de B.
- Testar datas em bordas de meia-noite e fuso.
- Testar offline, repetição e conflitos para toda mutação sincronizável.
- Cobertura não substitui qualidade das assertivas.
- Testes devem poder rodar localmente sem serviços de produção.

## 5. Fases e commits

- Trabalhar somente na fase ativa registrada no `PLAN.md`.
- Não marcar uma fase como concluída enquanto houver tarefa ou critério de saída pendente.
- Ao concluir integralmente cada fase, atualizar `PLAN.md` e `HISTORY.md` e criar um commit de encerramento.
- Nunca encerrar uma fase sem commit.
- Não iniciar a fase seguinte com worktree sujo da fase anterior.
- Usar a mensagem de commit prevista no `PLAN.md`, ajustando apenas o texto após os dois-pontos quando necessário.
- Commits de fase seguem Conventional Commits.
- Evitar commits parciais. Se um commit de recuperação for inevitável, identificá-lo como `wip`, não declarar a fase concluída e fazer squash antes do commit de encerramento sempre que seguro.
- Antes do commit: revisar diff, verificar arquivos não rastreados, procurar segredos e executar todos os gates da fase.
- Não usar `git add .` sem antes revisar `git status` e o diff.
- Não usar `git reset --hard`, force push ou reescrever histórico sem autorização explícita.
- Não alterar nem descartar mudanças do usuário.

O diretório precisa ser um repositório Git antes da Fase 0 poder ser encerrada.

## 6. Atualização do histórico

Em cada fase, registrar no `HISTORY.md`:

- escopo efetivamente entregue;
- evidência Red, Green e Refactor;
- migrações e endpoints;
- decisões e ADRs;
- impactos de segurança/privacidade;
- desvios e motivo;
- riscos e pendências;
- mensagem do commit de encerramento.

Não registrar dados reais de usuário, tokens, segredos ou payloads de saúde.

## 7. Arquitetura obrigatória

- Manter monólito modular; não criar microsserviços sem ADR aprovado.
- Frontend nunca acessa PostgreSQL diretamente.
- Toda API de produto fica sob `/api/v1`.
- Contratos são compartilhados e validados no frontend e backend.
- Regras de domínio não dependem de React, Fastify ou ORM.
- Regras de progressão são puras, versionadas, explicáveis e testadas.
- Nenhuma sugestão é aplicada sem aceite explícito.
- Templates são mutáveis para o futuro; sessões guardam snapshot histórico.
- Cada consulta/mutação de domínio é limitada ao usuário autenticado.
- Toda entidade sincronizável usa UUID, versão e tombstone conforme `SPEC.md`.
- IndexedDB é réplica local; PostgreSQL é fonte de verdade após sync.
- Cache Storage guarda app shell/recursos, não serve de banco de dados de saúde.
- Não depender de Background Sync para integridade.
- Conflitos não usam last-write-wins silencioso.

## 8. Datas

- Instantes reais: UTC em `timestamptz`, ISO 8601 na API.
- Data lógica: `date` local explícita.
- Recorrência: hora local mais fuso IANA.
- Não derivar sempre a data lógica convertendo um timestamp UTC.
- Não usar horário local do servidor como regra de negócio.
- Testar `America/Cuiaba`, meia-noite e mudança de fuso.

## 9. Segurança e privacidade

- Nunca armazenar senha em texto puro; usar Argon2id.
- Nunca colocar segredo no código, fixture, log ou commit.
- Cookies de sessão devem ser HttpOnly, Secure e SameSite adequado.
- Validar entrada e saída.
- Aplicar autorização no servidor, nunca confiar em filtro do cliente.
- PostgreSQL de produção não pode ser público.
- Não logar corpos, cookies, Authorization, notas, dores, hábitos ou medidas.
- Redigir cabeçalhos e identificadores sensíveis.
- Usar privilégio mínimo.
- Cadastro público exige verificação de e-mail, rate limit e proteção de abuso.
- Dados locais devem ser particionados por usuário.
- Logout e troca de conta não podem expor réplica de outro usuário.
- Exportação não inclui sessão, hash, token ou auditoria interna.
- Dependência nova exige justificativa, licença compatível e verificação de segurança.

## 10. Banco e migrações

- Toda alteração de schema passa por migração versionada.
- Não usar schema push automático em produção.
- Revisar SQL gerado.
- Testar migração em banco vazio e na versão anterior aplicável.
- Migração destrutiva exige estratégia expand/migrate/contract ou ADR.
- Nunca editar migração já aplicada em produção.
- Seed não pode conter dados pessoais reais.
- Backfill deve ser idempotente e observável.

## 11. API e erros

- Manter OpenAPI coerente com a implementação.
- Respostas não expõem stack trace ou detalhes internos.
- Mutações apropriadas devem ser idempotentes.
- Paginação histórica usa cursor.
- Concorrência usa versão explícita.
- Erros de validação, autenticação, autorização, conflito e rate limit são distintos.
- Health checks não expõem configuração ou segredos.

## 12. Frontend e PWA

- Mobile-first e WCAG 2.2 AA.
- Não usar cor como único indicador.
- Todo formulário mostra estado local/sync quando relevante.
- Escrita local e outbox devem ser atômicas.
- Atualização do service worker não pode perder trabalho.
- Tratar estados loading, vazio, offline, erro, pendente e conflito.
- Testar em viewport móvel desde o primeiro componente.
- Seguir `DESIGN.md`: label → controle usa 8 px; campos completos e `h2` → conteúdo usam 16 px.
  Pais de campos repetidos declaram grid/flex e gap explícito; nunca dependem do fluxo de bloco.
- Toda correção de ritmo interno deve auditar as demais páginas autenticadas e incluir regressão
  geométrica para impedir que labels, controles, títulos ou divisores voltem a ficar colados.
- Verificação final obrigatória em iPhone físico.

## 13. Dependências e simplicidade

- Preferir APIs da plataforma e dependências já adotadas.
- Não adicionar pacote para resolver utilidade trivial.
- Não duplicar bibliotecas com a mesma responsabilidade.
- Fixar lockfile.
- Não introduzir Redis, fila externa, WebSocket, CRDT ou microsserviço sem necessidade demonstrada e ADR.
- Manter código simples, explícito e tipado.

## 14. Qualidade antes de encerrar trabalho

Quando os scripts existirem, executar no mínimo:

1. Formatação/verificação de formatação.
2. Lint.
3. Typecheck.
4. Testes unitários.
5. Testes de integração afetados.
6. Testes de componente/E2E afetados.
7. Build.
8. Scan de segredos e dependências quando configurado.

Se algum gate não puder ser executado, não afirmar que passou. Registrar o motivo e manter a fase aberta.

## 15. Proibições

- Implementar fora da fase sem atualizar o plano.
- Pular Red em TDD.
- Aplicar progressão automaticamente.
- Interpretar ausência de relato como ausência de dor.
- Fazer diagnóstico ou prescrição clínica.
- Expor banco ou segredos.
- Logar dados de saúde.
- Sobrescrever conflito silenciosamente.
- Alterar histórico de treino ao editar template.
- Declarar fase concluída sem testes, histórico e commit.
