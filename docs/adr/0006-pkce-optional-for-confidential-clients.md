# ADR 0006 — PKCE obrigatório apenas para cliente público

- **Status:** aceita
- **Data:** 2026-08-06
- **Fase:** 32

## Contexto

O servidor de autorização do Torkout, criado na Fase 30 e descrito no [ADR-0005](0005-read-only-mcp-integration.md),
exige PKCE com `S256` de todo cliente. A exigência veio da especificação MCP, que a torna
obrigatória, e de OAuth 2.1, que a recomenda para todos os fluxos de código de autorização.

A Fase 32 expôs a mesma camada de dados por REST, para um GPT personalizado do ChatGPT Plus. Ao
percorrer o fluxo real, o editor de GPT Actions montou o pedido de autorização assim:

```text
GET /oauth/authorize?response_type=code&client_id=...&redirect_uri=...&state=...&scope=torkout:read
```

Sem `code_challenge` e sem `code_challenge_method`. O GPT Actions implementa o fluxo clássico de
**cliente confidencial**: ele exige `client_id` e `client_secret` configurados à mão, guarda o
segredo no servidor da OpenAI e autentica-se com ele na troca do código. Não há caminho de
configuração que o faça enviar PKCE.

A exigência atual, portanto, torna a integração impossível — não por escolha de segurança
deliberada, mas por uma suposição não verificada de que todo cliente faria o que o MCP faz.

O dado protegido é de saúde: treino, medidas corporais, alimentação e registros de dor. Afrouxar a
autenticação de forma ampla não é aceitável.

## Decisão

PKCE passa a ser **obrigatório para cliente público** e **dispensável para cliente confidencial**.

1. Um cliente registrado com `token_endpoint_auth_method: none` — todo cliente do MCP criado por
   registro dinâmico — continua obrigado a enviar `code_challenge` com `S256`. Um pedido sem desafio
   é recusado com `invalid_request`.
2. Um cliente registrado com `client_secret_post` ou `client_secret_basic` pode omitir o desafio. Ao
   omiti-lo, ele fica obrigado a apresentar o `client_secret` correto na troca do código, que já era
   verificado antes desta decisão.
3. Um desafio presente é sempre honrado, venha de quem vier. `plain` continua recusado. Um código
   emitido com desafio exige o verificador na troca, mesmo de cliente confidencial: não existe
   caminho para o cliente pular a verificação de um desafio que ele mesmo enviou.
4. A ausência de desafio é gravada no servidor, na própria linha do código de autorização. Quem
   decide se houve PKCE é a autorização, não a troca; um atacante que intercepte o código não
   consegue apagar o desafio depois para escapar da verificação.

O schema passou a aceitar `code_challenge` e `code_challenge_method` nulos, pela migração
`0014_phase_32_optional_pkce`.

## Consequências positivas

- O GPT Actions funciona sem token estático, sem cliente compartilhado e sem escopo novo.
- O MCP não perde nada: seus clientes são públicos e continuam sob a exigência integral.
- A dispensa é verificável no banco: um código sem desafio só existe para cliente com segredo.

## Consequências negativas e riscos

- **A defesa contra interceptação de código passa a depender do segredo do cliente**, para o cliente
  confidencial. Vazando o `client_secret` junto com um código interceptado, o atacante consegue
  trocar. O código vive 60 segundos, é de uso único, e reapresentá-lo revoga toda a concessão.
- **Divergência de OAuth 2.1**, que recomenda PKCE para todo fluxo de código. A divergência é
  consciente, restrita e documentada aqui; o servidor continua anunciando `S256` na descoberta.
- **Superfície de erro de operação:** registrar por engano o cliente do GPT como público faria a
  autorização falhar, e registrar um cliente público com segredo o dispensaria de PKCE sem que
  ninguém percebesse. O comando `pnpm ai:create-gpt-client` sempre cria confidencial.

Mitigações que continuam valendo, e que são a razão de o risco ser aceitável:

- `redirect_uri` é comparado por igualdade exata, sem curinga, prefixo ou sufixo.
- O segredo do cliente existe em claro uma única vez, na criação; o banco guarda hash SHA-256.
- O escopo é único e somente leitura.
- Reuso de código ou de refresh revoga toda a concessão daquele cliente.

## Alternativas consideradas

### Dispensar PKCE para qualquer cliente

Mais simples e claramente pior: enfraqueceria o MCP, cujos clientes são públicos e registrados
dinamicamente, para resolver um problema que é do REST. Rejeitada.

### Não mexer e abandonar o GPT Actions

Mantém o servidor estritamente aderente a OAuth 2.1. Rejeitada porque inviabiliza o objetivo da fase,
e porque a proteção que PKCE acrescenta a um cliente confidencial com `redirect_uri` exato e código
de 60 segundos é marginal diante do custo.

### Emitir um token estático para o GPT

Rejeitada de saída: um token sem expiração, sem consentimento e sem revogação seletiva é pior em
todas as dimensões que importam aqui.

## Verificação

Testes de integração em `apps/api/src/mcp.integration.test.ts`, bloco
`cliente confidencial sem PKCE`:

- cliente confidencial sem desafio recebe código;
- troca com o segredo correto devolve token;
- troca sem o segredo é recusada com `invalid_client`;
- cliente público sem desafio é recusado com `invalid_request`;
- `plain` é recusado mesmo vindo de cliente confidencial;
- desafio enviado e verificador ausente é recusado com `invalid_grant`.

Consulta que confirma a invariante em uma base real — precisa devolver zero linhas:

```sql
select c.client_id
  from mcp_authorization_codes c
  join mcp_oauth_clients o on o.client_id = c.client_id
 where c.code_challenge is null and o.client_secret_hash is null;
```

## Referências

- [ADR-0003 — Autenticação e autorização](0003-authentication.md)
- [ADR-0005 — Integração MCP remota somente leitura](0005-read-only-mcp-integration.md)
- `docs/GPT_ACTIONS.md`, seção de autenticação
- RFC 7636 (PKCE), RFC 6749 §4.1, OAuth 2.1 draft §4.1.1
