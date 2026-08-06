import { MCP_SCOPE } from '@torkout/contracts';
import { createDatabaseClient } from '@torkout/database';

import { registerClient } from '../mcp/oauth.js';

/**
 * Cria o cliente OAuth fixo do GPT Actions.
 *
 * O editor de GPT personalizado não faz registro dinâmico: ele pede `client_id` e `client_secret`
 * digitados à mão. Este comando registra um cliente confidencial no mesmo servidor de autorização do
 * MCP, com escopo somente leitura e `redirect_uri` exato — sem curinga, sem prefixo.
 *
 * O segredo aparece uma única vez, aqui, e é guardado apenas como hash SHA-256. Perdido, cria-se
 * outro cliente e revoga-se o anterior; não existe caminho para recuperá-lo.
 *
 * Uso:
 *   DATABASE_URL=... pnpm ai:create-gpt-client --redirect-uri https://chatgpt.com/aip/g-xxx/oauth/callback
 */

function argument(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === `--${name}`) {
      const value = process.argv[index + 1];
      if (value !== undefined && !value.startsWith('--')) values.push(value);
    }
  }
  return values;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL é obrigatório para registrar o cliente do GPT Actions.');
}

const redirectUris = argument('redirect-uri');
if (redirectUris.length === 0) {
  throw new Error(
    'Informe ao menos um --redirect-uri. O editor do GPT Actions mostra a URL de callback definitiva depois que a ação é salva.',
  );
}

const [name] = argument('name');
const { db, pool } = createDatabaseClient(connectionString);

try {
  const client = await registerClient(db, {
    clientName: name ?? 'ChatGPT GPT Actions',
    redirectUris,
    scope: MCP_SCOPE,
    // Confidencial: o GPT Actions guarda o segredo do lado do servidor da OpenAI, não no navegador.
    tokenEndpointAuthMethod: 'client_secret_post',
  });

  // Impresso uma única vez e nunca registrado em log. Copie agora para o editor do GPT.
  process.stdout.write(
    [
      '',
      'Cliente OAuth criado para o GPT Actions.',
      '',
      `  client_id:     ${client.clientId}`,
      `  client_secret: ${client.clientSecret ?? '(sem segredo)'}`,
      `  scope:         ${client.scope}`,
      `  redirect_uris: ${client.redirectUris.join(', ')}`,
      '',
      'O segredo não será mostrado de novo. Para revogar este cliente:',
      `  update mcp_oauth_clients set disabled_at = now() where client_id = '${client.clientId}';`,
      '',
    ].join('\n'),
  );
} finally {
  await pool.end();
}
