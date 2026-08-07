# Integração MCP — acesso remoto somente leitura

Este documento descreve o servidor MCP (Model Context Protocol) do Torkout: o que ele expõe, como se
autentica, como implantá-lo e como conectá-lo a um cliente.

> **Nenhuma tool desta versão modifica dados.** Todas as ferramentas apenas consultam e agregam
> registros existentes. Não existe caminho de escrita, remoção ou alteração pelo MCP.

## 1. Arquitetura

```text
Cliente MCP (ChatGPT, Claude)
  ↓ HTTPS, JSON-RPC 2.0 sobre Streamable HTTP, Authorization: Bearer
POST /mcp na aplicação Fastify existente
  ↓ userId resolvido a partir do token, nunca de argumento
apps/api/src/ai/operations.ts — operações neutras de protocolo
  ↓
apps/api/src/ai/queries.ts    — camada de leitura
  ↓
apps/api/src/data-snapshot.ts — mesma agregação usada pelo RELATORIO_EVOLUCAO.md
  ↓ consultas parametrizadas e recortadas por período, via Drizzle
PostgreSQL
```

O servidor MCP vive dentro da aplicação `@torkout/api`. Não há segundo serviço, segunda imagem nem
segunda porta. As regras de domínio — aderência, níveis, recuperação, café — vêm de
`@torkout/domain`, as mesmas que alimentam o produto e o relatório Markdown.

O PostgreSQL nunca é exposto. Não existe execução de SQL arbitrário: cada ferramenta chama funções
tipadas sobre um retrato já carregado e limitado ao período pedido.

| Arquivo                          | Papel                                                                   |
| -------------------------------- | ----------------------------------------------------------------------- |
| `apps/api/src/mcp/routes.ts`     | Rotas Fastify: descoberta OAuth, autorização, token, revogação e `/mcp` |
| `apps/api/src/mcp/server.ts`     | Construção do `McpServer` e do transporte sem estado                    |
| `apps/api/src/mcp/tools.ts`      | Fachada do protocolo: nome, descrição, anotação e schema de entrada     |
| `apps/api/src/mcp/oauth.ts`      | Servidor de autorização OAuth 2.1                                       |
| `apps/api/src/mcp/rate-limit.ts` | Limitador de janela fixa em memória                                     |
| `apps/api/src/ai/operations.ts`  | Operações neutras: validação, recorte e guardas de janela               |
| `apps/api/src/ai/context.ts`     | Montagem do contexto: fuso, período e retrato de dados                  |
| `apps/api/src/ai/queries.ts`     | Camada de leitura pura sobre o retrato de dados                         |
| `apps/api/src/ai/period.ts`      | Resolução de período no fuso do usuário                                 |
| `apps/api/src/data-snapshot.ts`  | Agregação compartilhada com a exportação                                |

Os arquivos em `ai/` não conhecem MCP. A camada REST de `/api/ai`, descrita em
[`GPT_ACTIONS.md`](GPT_ACTIONS.md), consome exatamente as mesmas operações — não existe segunda
implementação de nenhuma regra, e o limitador de chamadas é o mesmo objeto para as duas portas.

## 2. Transporte

Streamable HTTP, conforme a especificação MCP, em `POST /mcp`.

O transporte opera **sem sessão**: cada requisição HTTP carrega uma conversa JSON-RPC completa.
Reiniciar o processo ou colocar uma segunda réplica atrás do proxy não derruba o cliente. `GET` e
`DELETE` em `/mcp` respondem `405`, porque não há fluxo de servidor para cliente nem sessão a
encerrar.

Em produção o transporte exige HTTPS. O servidor confia em `X-Forwarded-Proto` e `X-Forwarded-For`
apenas nas faixas declaradas em `TRUST_PROXY`.

## 3. Autenticação e autorização

### Como funciona

O acesso é concedido por **OAuth 2.1 com PKCE obrigatório**, implementado pela própria aplicação.
Não existe token estático em variável de ambiente.

PKCE é obrigatório para todo cliente MCP, que é sempre público por nascer do registro dinâmico. A
dispensa criada na Fase 32 vale só para cliente confidencial — aquele que guarda um `client_secret` —
e existe porque o editor de GPT Actions não implementa PKCE. Ver
[ADR-0006](adr/0006-pkce-optional-for-confidential-clients.md).

```text
1. Cliente lê  GET /.well-known/oauth-protected-resource/mcp     (RFC 9728)
2. Cliente lê  GET /.well-known/oauth-authorization-server       (RFC 8414)
3. Cliente registra-se em POST /oauth/register                   (RFC 7591)
4. Navegador vai a GET /oauth/authorize?...&code_challenge=...&code_challenge_method=S256
   → exige a sessão do Better Auth; sem ela, a página pede que o titular entre no Torkout
   → apresenta a tela de consentimento descrevendo exatamente o que será lido
5. Consentimento concedido → redirecionamento com `code`
6. Cliente troca em POST /oauth/token com `code_verifier`
   → recebe `access_token` (1 h) e `refresh_token` (30 dias)
7. Cliente chama POST /mcp com `Authorization: Bearer <access_token>`
```

### Quem é o dono dos dados

O `userId` vem **exclusivamente** do token verificado e é fixado na construção do servidor MCP,
antes de qualquer ferramenta existir.

Nenhum schema de ferramenta aceita `userId`, `email`, `username` ou equivalente. Enviar esses campos
nos argumentos não tem efeito: eles são descartados na validação, e a consulta continua restrita ao
dono do token. Há teste de integração que exercita exatamente esse ataque.

Embora a instância de referência seja pessoal, o isolamento é por usuário desde o início: todas as
tabelas de credencial referenciam `users(id)`, e toda consulta filtra por `user_id`.

### Escopo

Existe um único escopo, `torkout:read`. Um pedido de qualquer outro escopo, inclusive
`torkout:write`, é recusado em `/oauth/authorize` com `invalid_scope`. A natureza somente leitura é
verificável no protocolo, não apenas prometida no código.

### Guarda de credenciais

| Credencial            | Vida                            | Armazenamento                              |
| --------------------- | ------------------------------- | ------------------------------------------ |
| Código de autorização | 60 s, uso único                 | Hash SHA-256                               |
| Token de acesso       | 1 hora                          | Hash SHA-256                               |
| Token de atualização  | 30 dias, rotacionado a cada uso | Hash SHA-256                               |
| Segredo de cliente    | Sem expiração                   | Hash SHA-256, só existe se o cliente pedir |

Os valores em claro aparecem uma única vez, na resposta que os cria. Um vazamento da base não devolve
credencial utilizável. Como são valores aleatórios de 256 bits, SHA-256 é adequado; Argon2id continua
sendo usado apenas para senhas, onde a lentidão importa.

Reapresentar um código já usado, ou um refresh já rotacionado, revoga toda a concessão daquele
cliente — o reuso é tratado como sinal de vazamento.

### Rotação e revogação

- **Rotação:** automática. Cada uso do refresh emite um par novo e invalida o anterior.
- **Revogação por token:** `POST /oauth/revoke` com `client_id` e `token`.
- **Revogação total de um cliente:**
  ```sql
  UPDATE mcp_tokens SET revoked_at = now()
  WHERE client_id = '<client_id>' AND revoked_at IS NULL;
  UPDATE mcp_consents SET revoked_at = now()
  WHERE client_id = '<client_id>' AND revoked_at IS NULL;
  ```
- **Desligar tudo:** `MCP_ENABLED=false` e reimplantar. As rotas deixam de existir.

## 4. Ferramentas

Todas declaram `readOnlyHint: true`. Todas aceitam recorte de período por `days` **ou** pelo par
`from`/`to`; informar os dois é recusado, em vez de resolvido por precedência silenciosa. Sem
recorte, o padrão é catorze dias.

| Tool                      | Parâmetros                                                   | Devolve                                                                                   |
| ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `get_profile`             | —                                                            | Altura, objetivo, horário preferido, unidades, fuso, data de início                       |
| `get_training_summary`    | `days`, `from`, `to`                                         | Aderência, sessões por estado, séries, repetições, RPE, resumo por exercício, recuperação |
| `get_workouts`            | `days`, `from`, `to`, `limit`, `exercise`, `status`          | Treinos estruturados com exercícios e séries                                              |
| `get_last_workout`        | `exercise`                                                   | Treino concluído mais recente                                                             |
| `get_exercise_progress`   | `exercise`, `days`, `from`, `to`                             | Série histórica, maior série, média, volume, tendência                                    |
| `get_measurements`        | `days`, `from`, `to`, `limit`                                | Peso, cintura, barriga, quadril, coxa, bíceps, jejum, observações                         |
| `get_measurement_summary` | `days`, `from`, `to`                                         | Primeiro, último, diferença absoluta e percentual, mínimo, máximo, contagem               |
| `get_walks`               | `days`, `from`, `to`                                         | Caminhadas e resumo de distância e duração                                                |
| `get_nutrition`           | `days`, `from`, `to`                                         | Estado do café, hábitos registrados, presença de whey                                     |
| `get_whey_history`        | `days`, `from`, `to`, `limit`                                | Consumo, quantidade, mistura, produto, tolerância                                         |
| `get_recovery`            | `days`, `from`, `to`, `limit`                                | RPE e registros de dor com todos os campos gravados                                       |
| `get_progress`            | `days`, `from`, `to`                                         | Visão consolidada, sequências e nível                                                     |
| `compare_periods`         | `current_from`, `current_to`, `previous_from`, `previous_to` | Comparação com diferenças absolutas e percentuais                                         |
| `get_recent_changes`      | `days`                                                       | Eventos recentes detectados nos dados                                                     |

### Recursos

- `profile://current` — perfil do titular.
- `training://recent` — resumo dos últimos catorze dias.
- `progress://summary` — progresso dos últimos noventa dias.

São atalhos para as mesmas consultas; nenhuma regra vive só neles.

### O que as tools não fazem

Elas devolvem fatos e métricas. Não avaliam, não recomendam treino, não interpretam sintoma e não
produzem conclusão clínica. O raciocínio fica no cliente.

### Exemplo de retorno

`get_training_summary` com `{"days": 14}`:

```json
{
  "requested_period": {
    "from": "2026-07-24",
    "to": "2026-08-06",
    "days": 14,
    "time_zone": "America/Cuiaba"
  },
  "strength": {
    "completed": 5,
    "partial": 1,
    "missed": 1,
    "cancelled": 0,
    "denominator": 7,
    "due": 7,
    "future_not_counted": 2,
    "adherence_percent": 78.57
  },
  "totals": { "sets": 42, "repetitions": 486, "distinct_exercises": 4 },
  "perceived_exertion": { "average": 6.2, "samples": 5 },
  "recovery": {
    "sessions_answered_without_pain": 4,
    "sessions_with_discomfort_reported": 1,
    "sessions_without_recovery_answer": 1,
    "notice": "Ausência de registro nunca significa ausência de dor. ..."
  },
  "exercises": {
    "Flexão": { "sessions": 5, "sets": 15, "total_repetitions": 172, "best_set": 14 }
  }
}
```

## 5. Semântica que o cliente precisa respeitar

Estas distinções são deliberadas e aparecem no retorno:

- **Nulo é ausência de registro, nunca zero.** Uma medida sem valor não é uma medida igual a zero.
- **Ausência de registro de dor não é ausência de dor.** `get_recovery` separa três estados:
  respondeu "sem dor", relatou desconforto, e não respondeu. Só o primeiro conta como sem dor.
- **Café sem açúcar é consumo.** Nunca é somado a "não consumi". Um dia sem linha é ausência de
  registro, contado em `days_without_record`.
- **Treino futuro não é falta.** Sessões cujo horário planejado ainda não passou ficam fora do
  denominador da aderência e aparecem em `future_not_counted`.
- **Cancelamento justificado sai do denominador**; parcial vale 0,5; concluída vale 1.
- **Cintura e barriga são medidas distintas.** Nunca são somadas nem substituídas uma pela outra.

## 6. Datas e fuso

O fuso vem de `user_profiles.time_zone` (padrão `America/Cuiaba`).

`days: 14` significa os catorze dias civis que terminam **hoje no fuso do usuário**. O "hoje" é
calculado com `Temporal`, a partir do instante UTC convertido para o fuso — nunca por
`toISOString().slice(0, 10)`, que deslocaria para o dia seguinte toda pergunta feita à noite.

Externamente: datas civis em `YYYY-MM-DD`, instantes em ISO 8601 com fuso.

## 7. Limites e paginação

| Limite                           | Valor                                                                |
| -------------------------------- | -------------------------------------------------------------------- |
| Registros detalhados por chamada | padrão 20, teto 100                                                  |
| Janela consultável de uma vez    | 730 dias                                                             |
| Detalhe por treino               | até 180 dias; acima disso a tool orienta usar `get_training_summary` |
| Período em `compare_periods`     | até 360 dias por período                                             |

As consultas ao banco são recortadas pelo período antes de sair: uma pergunta sobre catorze dias não
carrega anos de séries. Os filhos de sessão são carregados apenas para as sessões selecionadas, o que
evita o N+1 e o carregamento total.

## 8. Validação e erros

São recusados: período invertido, `days` negativo, zero ou fracionário, data civil inexistente
(`2026-02-30`), intervalo pela metade, `days` junto de `from`/`to`, limite acima do teto, estado de
sessão inválido e escopo não suportado.

As respostas de erro trazem uma frase curta em português. Nunca trazem stack trace, SQL, nome de
tabela nem caminho de arquivo.

## 9. Observabilidade

Eventos registrados: `mcp_client_registered`, `mcp_authorization_granted`,
`mcp_authorization_denied`, `mcp_token_issued`, `mcp_token_refreshed`, `mcp_request`.

`mcp_request` registra o método JSON-RPC, a duração, o `client_id` e os oito primeiros caracteres do
identificador do usuário — rastreável sem expor a conta.

Nunca são registrados: tokens, cookies, cabeçalho `Authorization`, corpo da requisição, medidas
corporais, notas, dores ou hábitos. A redação de `LOGGER_REDACT_PATHS` continua valendo.

## 10. Variáveis de ambiente

| Variável         | Padrão  | Descrição                                                                        |
| ---------------- | ------- | -------------------------------------------------------------------------------- |
| `MCP_ENABLED`    | `false` | Só `true` habilita. Desligada, as rotas não existem.                             |
| `MCP_PUBLIC_URL` | vazio   | URL pública do MCP. Vazia, usa `AUTH_BASE_URL`. Exige HTTPS fora de `localhost`. |

`MCP_ENABLED=true` também registra a camada REST de `/api/ai`, que compartilha este OAuth e este
escopo. Para manter o MCP sem expor o REST, defina `AI_REST_ENABLED=false`.

Nenhum segredo novo é necessário. Não commite `.env`; o domínio real não aparece no código.

## 11. Health check

`GET /mcp/health` confirma apenas que a integração está disponível:

```json
{ "status": "ok", "scope": "torkout:read", "token_lifetime_seconds": 3600 }
```

Não expõe configuração, versão de dependência nem estado do banco. Os health checks existentes,
`/health/live` e `/health/ready`, continuam sendo os usados pelo Docker e pelo Coolify.

## 12. Docker e Coolify

A integração usa a **mesma imagem, o mesmo serviço e a mesma porta 3000** da API. Nenhuma alteração
no `Dockerfile` foi necessária.

### Configuração no Coolify

1. Em _Environment Variables_ do serviço `api`, defina:
   - `MCP_ENABLED=true`
   - `MCP_PUBLIC_URL=https://<seu-dominio>` — ou o subdomínio dedicado, se usar um.
2. Reimplante. A migração `0013_phase_30_mcp_oauth` roda no serviço `migrate`, antes da API subir.
3. Confirme: `curl https://<seu-dominio>/mcp/health`.

O health check do container continua sendo `/health/ready`; não altere.

### Rota no mesmo domínio (recomendado)

O `nginx.conf` do serviço `web` já encaminha para a API:

```text
/mcp                          → api:3000
/oauth/*                      → api:3000
/.well-known/oauth-*          → api:3000
```

Com `proxy_buffering off` e tempo de leitura de 120 s, adequados ao transporte MCP.

### Subdomínio dedicado

Para `https://mcp.<seu-dominio>`:

1. Aponte o DNS do subdomínio para o mesmo host.
2. No Coolify, adicione o domínio ao serviço `web` (para reaproveitar o proxy e o certificado) ou
   crie um domínio próprio apontando para a porta 3000 do serviço `api`.
3. Defina `MCP_PUBLIC_URL=https://mcp.<seu-dominio>`.

O consentimento não exige que o subdomínio esteja em `TRUSTED_ORIGINS`: o servidor aceita a própria
origem, derivada de `MCP_PUBLIC_URL`, por construção. Acrescentá-lo à lista continua valendo apenas
se o navegador precisar chamar a API do produto a partir dele.

O emissor OAuth anunciado na descoberta é derivado de `MCP_PUBLIC_URL`; ele precisa bater exatamente
com o endereço pelo qual o cliente chega, ou a validação do cliente falhará.

### Reverse proxy

- Encaminhe `X-Forwarded-Proto` e `X-Forwarded-For`; declare as faixas do proxy em `TRUST_PROXY`.
- Não faça buffer nas respostas de `/mcp`.
- Tempo de leitura de pelo menos 120 s.
- **Não** abra CORS. O transporte é chamado de servidor para servidor pelo cliente MCP, não pelo
  navegador. A configuração de CORS existente continua restrita a `TRUSTED_ORIGINS`.

## 13. Desenvolvimento local

```bash
docker compose -f compose.development.yml up -d
# no .env local
MCP_ENABLED=true
MCP_PUBLIC_URL=http://localhost:3000
pnpm dev
```

Verificação rápida da descoberta e do porteiro:

```bash
curl -s http://localhost:3000/.well-known/oauth-protected-resource/mcp
curl -s -X POST http://localhost:3000/mcp -H 'content-type: application/json' -d '{}'
# → 401 com WWW-Authenticate apontando para os metadados
```

## 14. Como conectar um cliente

### ChatGPT

1. Ative o modo de desenvolvedor / conectores customizados na sua conta.
2. Adicione um conector com a URL `https://<seu-dominio>/mcp`.
3. Escolha autenticação **OAuth**. O ChatGPT descobre os endpoints e registra-se sozinho.
4. O navegador abrirá a tela de consentimento do Torkout. Se você não estiver logado, entre no
   Torkout em outra aba e volte.
5. Autorize. As ferramentas aparecem na conversa.

### Claude Code

```bash
claude mcp add --transport http torkout https://<seu-dominio>/mcp
```

O fluxo OAuth abre no navegador na primeira chamada.

### Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "torkout": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<seu-dominio>/mcp"]
    }
  }
}
```

## 15. Solução de problemas

| Sintoma                                  | Causa provável                                            | O que fazer                                       |
| ---------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `404` em `/mcp`                          | `MCP_ENABLED` não é `true`                                | Corrija a variável e reimplante                   |
| `401` com `WWW-Authenticate`             | Token ausente, expirado ou revogado                       | Reconecte o cliente; o refresh acontece sozinho   |
| `invalid_scope`                          | Cliente pediu escopo diferente de `torkout:read`          | Esperado; este servidor só concede leitura        |
| `invalid_grant` na troca do código       | `code_verifier` errado, código expirado (60 s) ou reusado | Refaça a autorização                              |
| `invalid_request` sobre `redirect_uri`   | URI não registrado para o cliente                         | Registre o cliente de novo pelo `/oauth/register` |
| Tela de consentimento pede login em laço | Cookie de sessão não chega à API                          | Confira o proxy e `TRUSTED_ORIGINS`               |
| Descoberta aponta para o domínio errado  | `MCP_PUBLIC_URL` não bate com o endereço público          | Ajuste a variável                                 |
| `429`                                    | Limite de chamadas atingido                               | Respeite o `Retry-After`                          |
| Cliente reclama de resposta grande       | Período longo demais                                      | Use `limit` menor ou uma tool de resumo           |

## 16. Limitações desta versão

- **Somente leitura.** Não existe criação, alteração nem remoção. Habilitar escrita exigirá escopo
  novo, consentimento próprio e um ADR que trate de idempotência e conflito.
- **Fotos de evolução não são expostas**, nem em metadados nem por endereço assinado.
- **Sem métricas nutricionais calculadas.** O produto registra hábitos, não quantidades de alimento;
  o MCP não estima macronutrientes que o titular não registrou.
- **Streaks e níveis são calculados dentro do período pedido**, coerentes com o painel de Progresso.
  Uma sequência anterior ao recorte não é considerada.
- **A tela de consentimento não usa o design system** do produto: é servida pela API com HTML mínimo
  e política de segurança própria, mais restritiva que a global.
- **Sem redirecionamento automático após o login.** Não estando logado, o titular precisa entrar no
  Torkout e voltar ao link de autorização.
- **Alterações locais pendentes não entram.** O MCP lê o PostgreSQL; o que ainda não sincronizou do
  aparelho não aparece. A exportação Markdown, que recebe o outbox do cliente, continua sendo o
  caminho para incluir pendências.
- **O limitador de chamadas é por processo.** Com mais de uma réplica, o limite efetivo se multiplica.

## 17. Relação com o relatório Markdown

A exportação `RELATORIO_EVOLUCAO.md` continua funcionando, sem alteração de saída. O MCP é uma forma
adicional de acesso, não uma substituição.

As duas compartilham `apps/api/src/data-snapshot.ts` e as regras de `@torkout/domain`, de modo que
uma correção de regra vale para as duas saídas ao mesmo tempo:

```text
data-snapshot.ts + @torkout/domain
   ├── evolution-report.ts → RELATORIO_EVOLUCAO.md
   └── ai/queries.ts → ai/operations.ts
                          ├── mcp/tools.ts → JSON das ferramentas MCP
                          └── ai/routes.ts → JSON da camada REST /api/ai
```
