import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { AI_BASE_PATH, AI_ENDPOINTS } from './routes.js';

/**
 * Verificação documental do contrato publicado para o GPT Actions.
 *
 * O documento é escrito à mão porque é ele que o editor do ChatGPT consome; o teste existe para que
 * ele não se descole da implementação. Um endpoint novo sem entrada no documento — ou uma entrada
 * sem endpoint — reprova aqui, nos dois sentidos.
 */

const document = readFileSync(
  new URL('../../../../docs/torkout-gpt-actions.openapi.yaml', import.meta.url),
  'utf8',
);

/** Chaves de caminho do documento: duas casas de indentação sob `paths:`. */
function documentedPaths(): string[] {
  return [...document.matchAll(/^ {2}(\/\S+):$/gm)].map((match) => match[1]!);
}

/** Blocos de caminho, para inspecionar quais verbos cada um declara. */
function pathBlocks(): Map<string, string> {
  const blocks = new Map<string, string>();
  const lines = document.split('\n');
  let current: string | null = null;
  let buffer: string[] = [];
  for (const line of lines) {
    const heading = /^ {2}(\/\S+):$/.exec(line);
    if (heading) {
      if (current) blocks.set(current, buffer.join('\n'));
      current = heading[1]!;
      buffer = [];
      continue;
    }
    if (current && /^ {0,2}\S/.test(line) && line.trim() !== '') {
      blocks.set(current, buffer.join('\n'));
      current = null;
      buffer = [];
      continue;
    }
    if (current) buffer.push(line);
  }
  if (current) blocks.set(current, buffer.join('\n'));
  return blocks;
}

describe('documento OpenAPI do GPT Actions', () => {
  it('declara OpenAPI 3.1.0 e um servidor HTTPS', () => {
    expect(document).toMatch(/^openapi: 3\.1\.0$/m);
    expect(document).toMatch(/^ {2}- url: https:\/\//m);
    expect(document).toMatch(/^ {2}title: /m);
    expect(document).toMatch(/^ {2}version: /m);
  });

  it('define OAuth com código de autorização e apenas o escopo de leitura', () => {
    expect(document).toContain('TorkoutOAuth:');
    expect(document).toContain('type: oauth2');
    expect(document).toContain('authorizationCode:');
    expect(document).toMatch(/authorizationUrl: https:\/\/\S+\/oauth\/authorize/);
    expect(document).toMatch(/tokenUrl: https:\/\/\S+\/oauth\/token/);
    expect(document).toContain('torkout:read:');
    expect(document).not.toContain('torkout:write');
  });

  it('documenta exatamente os endpoints implementados', () => {
    const implemented = [
      `${AI_BASE_PATH}/health`,
      ...AI_ENDPOINTS.map((endpoint) => `${AI_BASE_PATH}${endpoint.path}`),
    ].sort();
    expect(documentedPaths().sort()).toEqual(implemented);
  });

  it('usa o operationId esperado em cada endpoint', () => {
    const blocks = pathBlocks();
    for (const endpoint of AI_ENDPOINTS) {
      const block = blocks.get(`${AI_BASE_PATH}${endpoint.path}`);
      expect(block, `caminho ausente: ${endpoint.path}`).toBeDefined();
      expect(block).toContain(`operationId: ${endpoint.operationId}`);
    }
  });

  it('não descreve nenhuma operação de escrita', () => {
    for (const [path, block] of pathBlocks()) {
      const verbs = [...block.matchAll(/^ {4}(get|post|put|patch|delete|head|options):$/gm)].map(
        (match) => match[1],
      );
      expect(verbs, `verbos inesperados em ${path}`).toEqual(['get']);
    }
  });

  it('descreve as respostas de erro previstas em todo endpoint autenticado', () => {
    for (const [path, block] of pathBlocks()) {
      if (path === `${AI_BASE_PATH}/health`) continue;
      for (const status of ['401', '403', '429', '500']) {
        expect(block, `${path} sem resposta ${status}`).toContain(`'${status}':`);
      }
    }
  });

  it('resolve toda referência interna que usa', () => {
    const referenced = new Set(
      [...document.matchAll(/\$ref: '#\/components\/(\w+)\/(\w+)'/g)].map(
        (match) => `${match[1]}:${match[2]}`,
      ),
    );
    for (const reference of referenced) {
      const [section, name] = reference.split(':');
      const sectionIndex = document.indexOf(`\n  ${section}:\n`);
      expect(sectionIndex, `seção ausente: ${section}`).toBeGreaterThan(-1);
      expect(document.indexOf(`\n    ${name}:\n`, sectionIndex)).toBeGreaterThan(-1);
    }
  });

  it('orienta o modelo sobre as distinções que ele não pode confundir', () => {
    for (const guidance of [
      'nunca zero',
      'nunca significa ausência de dor',
      'nunca é somado a "não consumi"',
      'não é treino perdido',
      'não se substituem',
    ]) {
      expect(document, `falta a orientação: ${guidance}`).toContain(guidance);
    }
  });
});
