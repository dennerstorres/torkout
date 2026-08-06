import { MCP_SCOPE } from '@torkout/contracts';
import type { DatabaseClient } from '@torkout/database';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createMcpToolRegistrar, registerMcpResources } from './tools.js';

export const MCP_SERVER_NAME = 'torkout';
export const MCP_SERVER_VERSION = '1.0.0';

export interface McpSessionDependencies {
  database: DatabaseClient;
  now?: () => Date;
  userId: string;
}

/**
 * Constrói um servidor MCP já amarrado a um usuário. O `userId` é fixado aqui, a partir do token
 * verificado, e nenhuma tool consegue trocá-lo: o isolamento não depende de o modelo se comportar.
 */
export function createMcpServer(dependencies: McpSessionDependencies): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    {
      capabilities: { resources: {}, tools: {} },
      instructions: [
        `Servidor somente leitura dos dados de treino, medidas, alimentação, caminhadas e recuperação do titular autenticado (escopo ${MCP_SCOPE}).`,
        'Nenhuma ferramenta altera dados.',
        'As respostas trazem fatos e métricas. A interpretação é sua; o servidor não diagnostica, não prescreve treino e não faz recomendação clínica.',
        'Um valor nulo significa ausência de registro, nunca zero. Ausência de registro de dor nunca significa ausência de dor.',
        'Datas civis usam YYYY-MM-DD no fuso do usuário; instantes usam ISO 8601.',
      ].join(' '),
    },
  );

  createMcpToolRegistrar(dependencies)(server);
  registerMcpResources(server, dependencies);
  return server;
}

/**
 * Transporte sem estado: cada requisição HTTP carrega uma conversa completa de JSON-RPC. Sem sessão
 * no servidor, um reinício ou um segundo processo atrás do proxy não derruba o cliente.
 */
export function createStatelessTransport(): StreamableHTTPServerTransport {
  // `sessionIdGenerator` é omitido em vez de recebido como `undefined`: com
  // `exactOptionalPropertyTypes`, a propriedade opcional do SDK não aceita o valor explícito, e
  // ausente significa exatamente o modo sem sessão que queremos.
  return new StreamableHTTPServerTransport({ enableJsonResponse: true });
}

/**
 * O SDK declara `onclose` e afins como acessores obrigatórios de tipo `T | undefined`, enquanto a
 * interface `Transport` os declara opcionais. Sob `exactOptionalPropertyTypes` as duas formas não
 * são compatíveis, embora sejam idênticas em execução. A conversão fica isolada aqui em vez de
 * afrouxar o `tsconfig` do projeto inteiro.
 */
export async function connectTransport(
  server: McpServer,
  transport: StreamableHTTPServerTransport,
): Promise<void> {
  await server.connect(transport as unknown as Parameters<McpServer['connect']>[0]);
}
