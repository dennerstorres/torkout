/**
 * Caminhos que pertencem ao servidor, nunca ao aplicativo.
 *
 * O service worker responde toda navegação com o `index.html` do app. Sem esta lista, uma navegação
 * do navegador para um caminho do servidor — a tela de consentimento OAuth, por exemplo — é
 * interceptada e devolve a casca do aplicativo, com a URL original na barra de endereço e nenhuma
 * pista do que aconteceu. O servidor nunca chega a ser consultado.
 *
 * É a mesma lista usada como `navigateFallbackDenylist` e para forçar `NetworkOnly` no cache de
 * execução: um caminho de servidor não pode ser servido do cache nem do fallback.
 */
export const SERVER_OWNED_PATH_PATTERNS: readonly RegExp[] = [
  /^\/api\//,
  /^\/auth\//,
  // Autorização, token e revogação do servidor OAuth. O consentimento é uma página HTML servida
  // pela API, e é justamente uma navegação de navegador — o caso que o fallback engoliria.
  /^\/oauth\//,
  // Transporte MCP e seu health check.
  /^\/mcp(?:\/|$)/,
  // Descoberta de recurso protegido e de servidor de autorização (RFC 9728 e RFC 8414).
  /^\/\.well-known\//,
];

/** Verdadeiro quando o caminho pertence ao servidor e o aplicativo não deve respondê-lo. */
export function isServerOwnedPath(pathname: string): boolean {
  return SERVER_OWNED_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}
