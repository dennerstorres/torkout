# GPT Actions — camada REST somente leitura

Este documento descreve a camada REST de `/api/ai`, criada para que um GPT personalizado do ChatGPT
Plus consulte os dados do titular por GPT Actions.

> **Nenhum endpoint desta camada modifica dados.** Todas as rotas são `GET`. Não existe caminho de
> escrita, remoção ou alteração por aqui.

## 1. Objetivo

O conector MCP descrito em [`MCP.md`](MCP.md) exige modo de desenvolvedor e não está disponível no
editor de GPT personalizado. GPT Actions fala OpenAPI sobre REST. Esta camada existe para atender
esse cliente sem duplicar nenhuma regra.

Perguntas que o GPT passa a responder a partir do dado real:

- Como foram meus últimos 14 dias?
- Qual foi meu último treino?
- Como evoluíram minhas flexões?
- Como estão peso, cintura e barriga?
- Quantos treinos fiz sem dor registrada?
- Compare este mês com o anterior.
- Como foi minha aderência?
- Quais mudanças recentes aconteceram?

## 2. Arquitetura

```text
ChatGPT Plus → GPT personalizado → GPT Actions (OpenAPI)
  ↓ HTTPS, Authorization: Bearer
GET /api/ai/* na aplicação Fastify existente
  ↓ userId resolvido do token, nunca de parâmetro
apps/api/src/ai/operations.ts — operações neutras de protocolo
  ↓
apps/api/src/ai/queries.ts — camada de leitura
  ↓
apps/api/src/data-snapshot.ts — mesma agregação usada pelo RELATORIO_EVOLUCAO.md
  ↓ consultas parametrizadas e recortadas por período, via Drizzle
PostgreSQL
```

| Arquivo                                 | Papel                                                        |
| --------------------------------------- | ------------------------------------------------------------ |
| `apps/api/src/ai/routes.ts`             | Rotas `GET /api/ai/*`, porteiro, limitador e registro de log |
| `apps/api/src/ai/bearer.ts`             | Verificação do token e do escopo, sobre o OAuth do MCP       |
| `apps/api/src/ai/operations.ts`         | Operações neutras: validação, recorte e guardas de janela    |
| `apps/api/src/ai/context.ts`            | Montagem do contexto: fuso, período e retrato de dados       |
| `apps/api/src/ai/queries.ts`            | Camada de leitura pura sobre o retrato                       |
| `apps/api/src/ai/period.ts`             | Resolução de período no fuso do usuário                      |
| `apps/api/src/ai/query-params.ts`       | Conversão da string de consulta HTTP para a entrada tipada   |
| `apps/api/src/ai/create-gpt-client.ts`  | Comando que registra o cliente OAuth fixo do GPT Actions     |
| `docs/torkout-gpt-actions.openapi.yaml` | Contrato consumido pelo editor do GPT                        |

## 3. Relação com o MCP

**O MCP e o GPT Actions reutilizam a mesma camada de dados e regras.** Não existe segunda
implementação de consulta, de recorte de período, de limite ou de guarda de janela.

```text
@torkout/domain + data-snapshot.ts
   ├── evolution-report.ts        → RELATORIO_EVOLUCAO.md
   └── ai/queries.ts → ai/operations.ts
                          ├── mcp/tools.ts  → ferramentas MCP em /mcp
                          └── ai/routes.ts  → REST em /api/ai/*
```

Consequências práticas:

- Uma correção de regra vale para as três saídas ao mesmo tempo.
- O MCP continua funcionando exatamente como antes; `mcp/tools.ts` passou a ser apenas a fachada do
  protocolo — nome, descrição, anotação e schema de entrada.
- O limitador de chamadas é **o mesmo objeto** para `/mcp` e `/api/ai/*`. Não há dois contadores, e
  portanto não há teto dobrado.
- O servidor OAuth também é o mesmo: mesmo emissor, mesmo escopo, mesmo armazenamento de tokens.

## 4. Endpoints

Todos são `GET`. Todos aceitam recorte por `days` **ou** pelo par `from`/`to`; informar os dois é
recusado, em vez de resolvido por precedência silenciosa. Sem recorte, o padrão é catorze dias.

| Endpoint                      | `operationId`           | Parâmetros de consulta                                                                |
| ----------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| `/api/ai/profile`             | `getProfile`            | —                                                                                     |
| `/api/ai/training-summary`    | `getTrainingSummary`    | `days`, `from`, `to`                                                                  |
| `/api/ai/workouts`            | `getWorkouts`           | `days`, `from`, `to`, `limit`, `exercise`, `status`                                   |
| `/api/ai/last-workout`        | `getLastWorkout`        | `exercise`                                                                            |
| `/api/ai/exercise-progress`   | `getExerciseProgress`   | `exercise` (obrigatório), `days`, `from`, `to`                                        |
| `/api/ai/measurements`        | `getMeasurements`       | `days`, `from`, `to`, `limit`                                                         |
| `/api/ai/measurement-summary` | `getMeasurementSummary` | `days`, `from`, `to`                                                                  |
| `/api/ai/walks`               | `getWalks`              | `days`, `from`, `to`                                                                  |
| `/api/ai/nutrition`           | `getNutrition`          | `days`, `from`, `to`                                                                  |
| `/api/ai/whey-history`        | `getWheyHistory`        | `days`, `from`, `to`, `limit`                                                         |
| `/api/ai/recovery`            | `getRecovery`           | `days`, `from`, `to`, `limit`                                                         |
| `/api/ai/progress`            | `getProgress`           | `days`, `from`, `to`                                                                  |
| `/api/ai/recent-changes`      | `getRecentChanges`      | `days` (padrão 14)                                                                    |
| `/api/ai/compare-periods`     | `comparePeriods`        | `current_from`, `current_to`, `previous_from`, `previous_to` — os quatro obrigatórios |
| `/api/ai/health`              | `getHealth`             | — (único sem credencial)                                                              |

A resposta é sempre JSON, nunca Markdown, e é o mesmo objeto que a ferramenta MCP correspondente
devolve. Há teste de integração que compara os dois lado a lado.

### Semântica que o cliente precisa respeitar

Estas distinções são deliberadas e aparecem no retorno:

- **Nulo é ausência de registro, nunca zero.**
- **Ausência de registro de dor não é ausência de dor.** `/recovery` separa três estados:
  respondeu "sem dor", relatou desconforto e não respondeu. Só o primeiro conta como sem dor.
- **Café sem açúcar é consumo.** Nunca é somado a "não consumi". Um dia sem linha é ausência de
  registro, contado em `days_without_record`.
- **Treino futuro não é falta.** Fica fora do denominador e aparece em `future_not_counted`.
- **Cancelamento justificado sai do denominador**; parcial vale 0,5; concluída vale 1.
- **Cintura e barriga são medidas distintas.** Nunca são somadas nem substituídas uma pela outra.

As descrições do documento OpenAPI repetem cada uma dessas regras no endpoint em que ela importa,
para reduzir a chance de o modelo interpretar o dado errado.

## 5. Autenticação

`Authorization: Bearer <access_token>`, sobre o **mesmo servidor OAuth 2.1 com PKCE** do MCP. Não
existe token estático em variável de ambiente, e não existe segundo emissor.

O `userId` vem exclusivamente do token verificado. Nenhum endpoint aceita `userId`, `email` ou
`username` para escolher o titular: esses campos são descartados na validação, e a consulta continua
restrita ao dono do token. Há teste de integração que exercita exatamente esse ataque.

Existe um único escopo, `torkout:read`. Um token com qualquer outro escopo recebe `403`.

### Códigos HTTP

| Código | Quando                                              | `error`                                |
| ------ | --------------------------------------------------- | -------------------------------------- |
| `200`  | Sucesso                                             | —                                      |
| `400`  | Parâmetro inválido ou período fora dos limites      | `invalid_parameter`, `period_too_long` |
| `401`  | Credencial ausente, inválida, expirada ou revogada  | `unauthorized`, `invalid_token`        |
| `403`  | Token sem o escopo `torkout:read`                   | `insufficient_scope`                   |
| `429`  | Limite de chamadas atingido; respeite `Retry-After` | `rate_limited`                         |
| `500`  | Erro interno inesperado                             | `internal_error`                       |

O corpo do erro é sempre curto:

```json
{ "error": "invalid_parameter", "message": "O início do período não pode ser posterior ao fim." }
```

Nunca traz stack trace, SQL, nome de tabela, caminho local nem segredo.

## 6. Client OAuth para GPT Actions

O editor de GPT Actions **não faz registro dinâmico** (RFC 7591): ele pede `client_id` e
`client_secret` digitados à mão. Por isso existe um cliente fixo, separado do que o conector MCP
registra sozinho.

### Em produção, dentro do contêiner da API

É o caminho normal: o contêiner já tem `DATABASE_URL` no ambiente, então nada de credencial precisa
ser digitado. A imagem de produção não carrega o código-fonte nem `pnpm`, por isso o comando é o
JavaScript já compilado — o mesmo padrão do serviço `migrate`:

```bash
docker exec -it <contêiner-da-api> \
  node dist/ai/create-gpt-client.js \
  --redirect-uri https://chatgpt.com/aip/g-XXXXXXXX/oauth/callback \
  --name "Meu GPT do Torkout"
```

No Coolify, abra o terminal do serviço `api` e rode a partir de `node dist/...`.

### Em desenvolvimento, a partir do repositório

```bash
DATABASE_URL=postgresql://... pnpm ai:create-gpt-client \
  --redirect-uri https://chatgpt.com/aip/g-XXXXXXXX/oauth/callback \
  --name "Meu GPT do Torkout"
```

Nos dois casos o comando devolve:

```text
  client_id:     ...
  client_secret: ...
  scope:         torkout:read
  redirect_uris: https://chatgpt.com/aip/g-XXXXXXXX/oauth/callback
```

- O segredo aparece **uma única vez**, nessa saída, e nunca é registrado em log. No banco só existe o
  hash SHA-256.
- Perdido o segredo, crie outro cliente e desative o anterior. Não há caminho de recuperação.
- O escopo é fixo em `torkout:read`. Pedir outro é recusado com `invalid_scope`.

### Revogar

```sql
-- Desativa o cliente: novas autorizações e trocas de token param de funcionar.
update mcp_oauth_clients set disabled_at = now() where client_id = '<client_id>';

-- Invalida o que já foi emitido.
update mcp_tokens   set revoked_at = now() where client_id = '<client_id>' and revoked_at is null;
update mcp_consents set revoked_at = now() where client_id = '<client_id>' and revoked_at is null;
```

## 7. Callback URL

**A URL de callback definitiva é fornecida pelo editor do GPT Actions**, depois que a ação é salva
pela primeira vez. Ela tem o formato `https://chatgpt.com/aip/<id-da-ação>/oauth/callback`.

O fluxo prático é:

1. Crie o cliente com uma URL provisória, salve a ação no editor e leia a URL real que ele mostra.
2. Crie o cliente definitivo com essa URL exata, ou atualize o registro:

   ```sql
   update mcp_oauth_clients
      set redirect_uris = array['https://chatgpt.com/aip/g-XXXXXXXX/oauth/callback']
    where client_id = '<client_id>';
   ```

A comparação de `redirect_uri` é exata. **Não existe curinga, prefixo nem sufixo**, por decisão de
segurança: um curinga em cliente confidencial é caminho de sequestro de código de autorização.

## 8. Variáveis de ambiente

| Variável          | Padrão  | Descrição                                                                      |
| ----------------- | ------- | ------------------------------------------------------------------------------ |
| `MCP_ENABLED`     | `false` | Só `true` habilita a integração. Desligada, `/mcp` e `/api/ai/*` não existem.  |
| `MCP_PUBLIC_URL`  | vazio   | URL pública. Vazia, usa `AUTH_BASE_URL`. Exige HTTPS fora de `localhost`.      |
| `AI_REST_ENABLED` | `true`  | Desligamento seletivo do REST, mantendo o MCP. Só vale com `MCP_ENABLED=true`. |

Nenhum segredo novo é necessário. O `client_secret` do GPT vive no banco, em hash, e no editor do
ChatGPT — nunca no código, no `.env` nem em commit.

## 9. OpenAPI

O contrato está em [`torkout-gpt-actions.openapi.yaml`](torkout-gpt-actions.openapi.yaml), em
OpenAPI 3.1.0. Ele cobre todos os endpoints, parâmetros, schemas de resposta e erros, com descrições
escritas para orientar o modelo.

`apps/api/src/ai/openapi.test.ts` confere que o documento não se descola da implementação: caminho
documentado sem rota, rota sem documentação, `operationId` divergente, verbo de escrita ou referência
interna quebrada reprovam o gate.

Troque o `servers[0].url` pela sua instância antes de colar no editor, caso não use o domínio de
referência.

## 10. Como configurar no ChatGPT Plus

1. **Crie o cliente OAuth** com o comando da seção 6, usando uma URL de callback provisória.
2. No ChatGPT, vá em _Explorar GPTs → Criar → Configurar → Criar nova ação_.
3. Em **Schema**, cole o conteúdo de `docs/torkout-gpt-actions.openapi.yaml`.
4. Em **Authentication**, escolha **OAuth** e preencha:
   - _Client ID_ e _Client Secret_: os devolvidos pelo comando.
   - _Authorization URL_: `https://<seu-dominio>/oauth/authorize`
   - _Token URL_: `https://<seu-dominio>/oauth/token`
   - _Scope_: `torkout:read`
   - _Token Exchange Method_: `Default (POST request)`
5. Salve. O editor passa a mostrar a **Callback URL** definitiva.
6. Registre essa URL exata no cliente, conforme a seção 7.
7. Clique em testar uma ação. O navegador abrirá a tela de consentimento do Torkout. Se você não
   estiver logado, entre no Torkout em outra aba e volte.
8. Autorize. As ações passam a responder na conversa.

Vale acrescentar às instruções do GPT que ausência de registro nunca é ausência de sintoma, e que ele
não deve fazer diagnóstico nem prescrição — o servidor devolve fatos, o raciocínio é do cliente.

## 11. Como testar com curl

```bash
# Disponibilidade, sem credencial.
curl -s https://<seu-dominio>/api/ai/health

# Porteiro: sem credencial responde 401 e aponta os metadados do OAuth.
curl -s -i https://<seu-dominio>/api/ai/profile | head -20

# Com um token válido já obtido pelo fluxo OAuth:
TOKEN=...
curl -s -H "Authorization: Bearer $TOKEN" \
  'https://<seu-dominio>/api/ai/training-summary?days=14'

curl -s -H "Authorization: Bearer $TOKEN" \
  'https://<seu-dominio>/api/ai/exercise-progress?exercise=flexao&days=90'

curl -s -H "Authorization: Bearer $TOKEN" \
  'https://<seu-dominio>/api/ai/compare-periods?current_from=2026-07-24&current_to=2026-08-06&previous_from=2026-07-10&previous_to=2026-07-23'
```

Em desenvolvimento local, com `MCP_ENABLED=true` e `MCP_PUBLIC_URL=http://localhost:3000`, troque o
domínio por `http://localhost:3000`.

## 12. Configuração no Coolify

A camada usa a **mesma imagem, o mesmo serviço e a mesma porta 3000** da API. Nenhuma alteração no
`Dockerfile` foi necessária, e nenhuma migração nova existe: o esquema OAuth já veio na
`0013_phase_30_mcp_oauth`.

1. Em _Environment Variables_ do serviço `api`, confirme `MCP_ENABLED=true` e `MCP_PUBLIC_URL`.
   `AI_REST_ENABLED` não precisa ser definida: ausente, vale `true`. Defina como `false` apenas se
   quiser manter o MCP sem expor o REST.
2. Se o `nginx.conf` do serviço `web` encaminha por prefixo, garanta que `/api` já vá para
   `api:3000` — é o mesmo prefixo das rotas de produto, então normalmente já vai.
3. Reimplante e confirme: `curl https://<seu-dominio>/api/ai/health`.

O health check do container continua sendo `/health/ready`; não altere.

**Não abra CORS.** O GPT Actions chama a API de servidor para servidor, não pelo navegador. A
configuração de CORS existente continua restrita a `TRUSTED_ORIGINS`.

## 13. Observabilidade

Cada chamada registra o evento `ai_request` com: `operationId`, duração, status, `client_id` e os
oito primeiros caracteres do identificador do usuário — rastreável sem expor a conta. Falha inesperada
registra `ai_request_failed` com a identificação da requisição.

Nunca são registrados: tokens, cookies, cabeçalho `Authorization`, corpo da resposta, medidas
corporais, notas, dores, alimentação ou hábitos. A redação de `LOGGER_REDACT_PATHS` continua valendo.

## 14. Limites

| Limite                           | Valor                                              |
| -------------------------------- | -------------------------------------------------- |
| Registros detalhados por chamada | padrão 20, teto 100                                |
| Janela consultável de uma vez    | 730 dias                                           |
| Detalhe por treino               | até 180 dias; acima disso use `getTrainingSummary` |
| Período em `comparePeriods`      | até 360 dias por período                           |
| Chamadas por minuto              | 120 por endereço, compartilhado com `/mcp`         |

As consultas ao banco são recortadas pelo período antes de sair: uma pergunta sobre catorze dias não
carrega anos de séries. Os filhos de sessão são carregados apenas para as sessões selecionadas, o que
evita o N+1.

## 15. Solução de problemas

| Sintoma                                   | Causa provável                                         | O que fazer                               |
| ----------------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `404` em `/api/ai/*`                      | `MCP_ENABLED` não é `true`, ou `AI_REST_ENABLED=false` | Corrija a variável e reimplante           |
| `401` com `WWW-Authenticate`              | Token ausente, expirado ou revogado                    | Reautorize a ação no editor do GPT        |
| `403 insufficient_scope`                  | Token emitido com outro escopo                         | Refaça a autorização com `torkout:read`   |
| `invalid_request` sobre `redirect_uri`    | Callback do GPT não registrada no cliente              | Registre a URL exata, conforme a seção 7  |
| `invalid_client` na troca do código       | `client_secret` errado ou cliente desativado           | Confira o segredo; crie outro cliente     |
| Tela de consentimento pede login em laço  | Cookie de sessão não chega à API                       | Confira o proxy e `TRUSTED_ORIGINS`       |
| `400 period_too_long` em `/workouts`      | Mais de 180 dias pedidos com detalhe                   | Use `getTrainingSummary`                  |
| `429`                                     | Limite de chamadas atingido                            | Respeite o `Retry-After`                  |
| GPT responde "sem dor" sem haver resposta | Interpretação errada de ausência de registro           | Reforce a distinção nas instruções do GPT |

## 16. Limitações desta versão

- **Somente leitura.** Não existe criação, alteração nem remoção. Habilitar escrita exigirá escopo
  novo, consentimento próprio e um ADR que trate de idempotência e conflito.
- **Fotos de evolução não são expostas**, nem em metadados nem por endereço assinado.
- **Sem métricas nutricionais calculadas.** O produto registra hábitos, não quantidades de alimento.
- **Streaks e níveis são calculados dentro do período pedido**, coerentes com o painel de Progresso.
- **Alterações locais pendentes não entram.** A camada lê o PostgreSQL; o que ainda não sincronizou
  do aparelho não aparece. A exportação Markdown continua sendo o caminho para incluir pendências.
- **O limitador de chamadas é por processo.** Com mais de uma réplica, o limite efetivo se multiplica.
- **A URL de callback precisa ser registrada à mão** depois que o editor do GPT a revela. Não há
  curinga de `redirect_uri`, por decisão de segurança.
- **O `servers[0].url` do documento OpenAPI é fixo.** Instâncias em outro domínio precisam editá-lo
  antes de colar no editor.
