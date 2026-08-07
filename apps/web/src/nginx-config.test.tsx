import { describe, expect, it } from 'vitest';

import nginxConf from '../nginx.conf?raw';
import { SERVER_OWNED_PATH_PATTERNS } from './pwa-routes.js';

/**
 * Regressão da Fase 32: o `nginx` acrescentava os cabeçalhos de segurança do aplicativo também às
 * respostas que apenas repassa da API, porque estavam no bloco `server` e as `location` de proxy os
 * herdavam. A API já define os seus — e os define de forma mais completa.
 *
 * O estrago não era só redundância. A tela de consentimento OAuth declara
 * `referrer-policy: same-origin` de propósito, para que o formulário não saia com `Origin: null`; o
 * `no-referrer` do nginx vinha depois e vencia, e o servidor recusava o próprio formulário. A
 * política de conteúdo duplicada também bloqueava o estilo embutido da página, que é liberado por
 * nonce na política da rota e proibido pela do nginx.
 */

const SECURITY_HEADERS = [
  'Content-Security-Policy',
  'Permissions-Policy',
  'Referrer-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
];

/** Trecho do bloco `server` antes da primeira `location`, onde a herança nasce. */
function serverPreamble(): string {
  return nginxConf.slice(0, nginxConf.indexOf('location'));
}

/** Corpo de cada `location`, na ordem em que aparecem. */
function locations(): Array<{ body: string; matcher: string }> {
  const found: Array<{ body: string; matcher: string }> = [];
  const pattern = /^ {2}location ([^{]+)\{$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(nginxConf)) !== null) {
    const start = match.index + match[0].length;
    const end = nginxConf.indexOf('\n  }', start);
    found.push({ body: nginxConf.slice(start, end), matcher: match[1]!.trim() });
  }
  return found;
}

/** Uma `location` é de proxy quando repassa para a API. */
function proxyLocations() {
  return locations().filter((location) => location.body.includes('proxy_pass'));
}

describe('cabeçalhos do nginx', () => {
  it('não declara cabeçalho de segurança no bloco server, de onde tudo herda', () => {
    for (const header of SECURITY_HEADERS) {
      expect(serverPreamble(), `${header} ainda está no bloco server`).not.toContain(
        `add_header ${header}`,
      );
    }
  });

  it('não acrescenta cabeçalho de segurança às respostas repassadas da API', () => {
    const proxies = proxyLocations();
    expect(proxies.length).toBeGreaterThan(0);
    for (const location of proxies) {
      for (const header of SECURITY_HEADERS) {
        expect(location.body, `${location.matcher} acrescenta ${header}`).not.toContain(
          `add_header ${header}`,
        );
      }
    }
  });

  it('mantém os cabeçalhos onde o próprio nginx serve o conteúdo', () => {
    const served = locations().filter((location) => !location.body.includes('proxy_pass'));
    expect(served.length).toBeGreaterThan(0);
    for (const location of served) {
      expect(location.body, `${location.matcher} sem cabeçalhos de segurança`).toContain(
        'include /etc/nginx/security-headers.conf;',
      );
    }
  });

  it('repassa à API todo caminho que pertence ao servidor', () => {
    const matchers = proxyLocations()
      .map((location) => location.matcher)
      .join(' ');
    for (const pattern of SERVER_OWNED_PATH_PATTERNS) {
      // Os padrões do service worker e os do nginx são escritos em dialetos diferentes; a
      // conferência é pelo prefixo, que é o que os dois têm em comum.
      const prefix = pattern.source.replace(/^\^\\\//, '').replace(/[\\^$(?:|)/]|\{.*$/g, '');
      expect(matchers, `nenhuma location repassa ${prefix}`).toContain(prefix);
    }
  });
});
