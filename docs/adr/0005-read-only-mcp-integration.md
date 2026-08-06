# ADR 0005 — Integração MCP remota somente leitura

- **Status:** aceita
- **Data:** 2026-08-06
- **Fase:** 30

## Contexto

O produto já exporta um relatório Markdown completo (`RELATORIO_EVOLUCAO.md`) para levar o histórico
a uma leitura externa. Esse formato responde bem a uma revisão inteira, mas mal a uma pergunta
pontual: para saber como foram os últimos catorze dias, o titular precisa gerar o arquivo, colá-lo em
uma conversa e repetir tudo no dia seguinte, quando o arquivo já está velho.

O titular quer perguntar em linguagem natural e receber a resposta a partir do dado real. O Model
Context Protocol é o caminho padronizado para isso, e o ChatGPT o consome por conectores remotos.

Três decisões precisavam ser tomadas: onde o servidor MCP vive, como o transporte se encaixa na
aplicação Fastify existente e como o acesso é autenticado sem abrir um caminho paralelo de entrada.

## Decisão

### Um servidor no monólito, não um segundo serviço

O servidor MCP é registrado na aplicação Fastify existente, em `/mcp`, e reaproveita a camada de
agregação que já alimenta o relatório Markdown. Não há segunda aplicação, segunda imagem, segunda
porta nem segundo caminho até o PostgreSQL.

A alternativa — um serviço separado — exigiria duplicar acesso ao banco, configuração, observabilidade
e implantação para expor as mesmas regras de domínio, contrariando a arquitetura de monólito modular
sem apresentar necessidade demonstrada.

### SDK oficial com transporte Streamable HTTP sem estado

Usamos `@modelcontextprotocol/sdk`. O transporte `StreamableHTTPServerTransport` opera sobre
`IncomingMessage` e `ServerResponse` do Node, então liga direto em `request.raw` e `reply.raw` do
Fastify: o Express e o Hono que o pacote traz como dependências ficam fora do caminho de requisição.

O transporte é configurado sem sessão. Cada requisição HTTP carrega uma conversa JSON-RPC completa,
de modo que reiniciar o processo ou colocar uma segunda réplica atrás do proxy não derruba o cliente.

O custo aceito é o peso das dependências não usadas do SDK na imagem. Escrever o protocolo à mão
evitaria esse peso, mas trocaria um risco pequeno e visível por um risco maior e silencioso: uma
incompatibilidade sutil com o cliente, que só apareceria em produção.

### OAuth 2.1 próprio, reaproveitando a sessão existente

O conector do ChatGPT só oferece "sem autenticação" ou OAuth. Como um MCP sem autenticação sobre
dados de saúde está fora de questão, implementamos um servidor de autorização OAuth 2.1 próprio, com
PKCE `S256` obrigatório, registro dinâmico de cliente (RFC 7591) e os documentos de descoberta das
RFC 8414 e 9728.

O consentimento não cria um segundo caminho de entrada: a tela de autorização exige a sessão do
Better Auth que já autentica o produto. Quem autoriza é o titular já logado.

O escopo é único e explícito, `torkout:read`. Um pedido de qualquer outro escopo é recusado, o que
torna a natureza somente leitura verificável no protocolo, e não apenas uma promessa do código.

### O usuário nunca vem de argumento

O `userId` é fixado na construção do servidor MCP, a partir do token verificado, antes de qualquer
ferramenta existir. Nenhum schema de ferramenta aceita `userId`, `email` ou equivalente. O isolamento
não depende de o modelo se comportar bem.

## Consequências

- Uma pergunta em conversa passa a ser respondida com dado atual, sem exportação manual.
- O relatório Markdown continua existindo sem alteração de saída; as duas saídas compartilham a mesma
  camada de agregação, então uma regra corrigida vale para as duas.
- A superfície pública da aplicação cresce: `/mcp`, `/oauth/*` e dois documentos de descoberta.
  Todos ficam desligados enquanto `MCP_ENABLED` não for `true`.
- Quatro tabelas novas guardam clientes, códigos, consentimentos e tokens. Nenhuma guarda dado de
  saúde, e nenhuma credencial é guardada em claro.
- A escrita pelo MCP fica fora desta versão. Adicioná-la exigirá um escopo novo, consentimento
  próprio e um ADR que trate de idempotência e conflito.

## Alternativas consideradas

- **Token estático em variável de ambiente.** Simples, mas não é revogável por cliente, não distingue
  quem pediu o quê e não conecta no ChatGPT. Recusada.
- **Servidor MCP em processo separado com STDIO e uma ponte local.** Funciona para clientes de
  desktop, mas não atende ao objetivo declarado de conectar um serviço remoto. Recusada.
- **Escrever o protocolo MCP à mão sobre Fastify.** Evitaria as dependências não usadas do SDK, ao
  custo de manter compatibilidade de protocolo por conta própria. Recusada, com a decisão registrada
  para revisão caso o peso da imagem passe a incomodar.
