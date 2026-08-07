import { describe, expect, it } from 'vitest';

// O fonte do config entra como texto: este projeto compila para o navegador e não tem `node:fs`,
// e importar o config executável quebraria sob jsdom.
import viteConfigSource from '../vite.config.ts?raw';
import { isServerOwnedPath } from './pwa-routes.js';

/**
 * Regressão da Fase 32: o service worker respondia toda navegação com a casca do aplicativo,
 * inclusive `/oauth/authorize`. A tela de consentimento nunca chegava ao navegador — o titular via o
 * Torkout aberto com a URL de autorização na barra de endereço, sem nada acontecer, e a autorização
 * do GPT e do MCP ficava impossível de concluir depois que o service worker assumia a origem.
 */

describe('caminhos que pertencem ao servidor', () => {
  it('reconhece a tela de consentimento e os demais caminhos do OAuth', () => {
    for (const path of ['/oauth/authorize', '/oauth/token', '/oauth/revoke', '/oauth/register']) {
      expect(isServerOwnedPath(path), path).toBe(true);
    }
  });

  it('reconhece o transporte MCP e a descoberta', () => {
    for (const path of [
      '/mcp',
      '/mcp/health',
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-authorization-server',
    ]) {
      expect(isServerOwnedPath(path), path).toBe(true);
    }
  });

  it('continua reconhecendo a API e a autenticação', () => {
    expect(isServerOwnedPath('/api/ai/profile')).toBe(true);
    expect(isServerOwnedPath('/auth/sign-in')).toBe(true);
  });

  it('não sequestra as rotas do próprio aplicativo', () => {
    for (const path of ['/', '/hoje', '/historico', '/progresso', '/demo', '/perfil']) {
      expect(isServerOwnedPath(path), path).toBe(false);
    }
  });

  it('não confunde uma rota do app que apenas começa parecido', () => {
    // `/mcp` é exato ou seguido de barra; uma tela chamada `/mcpanel` seria do aplicativo.
    expect(isServerOwnedPath('/mcpanel')).toBe(false);
  });
});

/**
 * O config do Vite não pode ser importado daqui: ele roda no Node, e o ambiente jsdom desta suíte
 * quebra na resolução de `import.meta.url`. A verificação é sobre o fonte, e é o que importa —
 * garantir que a configuração do service worker consome esta lista em vez de manter uma cópia.
 */
describe('configuração do service worker', () => {
  it('importa a lista compartilhada em vez de repetir os padrões', () => {
    expect(viteConfigSource).toContain('SERVER_OWNED_PATH_PATTERNS');
    expect(viteConfigSource).toMatch(/from '\.\/src\/pwa-routes\.js'/);
  });

  it('usa a lista no fallback de navegação', () => {
    expect(viteConfigSource).toMatch(
      /navigateFallbackDenylist: \[\.\.\.SERVER_OWNED_PATH_PATTERNS/,
    );
  });

  it('não deixa nenhum padrão de caminho de servidor escrito à mão', () => {
    const workbox = viteConfigSource.slice(viteConfigSource.indexOf('workbox: {'));
    expect(workbox).not.toContain('/^\\/api\\//');
    expect(workbox).not.toContain('/^\\/auth\\//');
  });
});
