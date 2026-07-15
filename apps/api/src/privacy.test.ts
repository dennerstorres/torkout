import { describe, expect, it } from 'vitest';

import { PUBLIC_PRIVACY_DOCUMENTS } from './privacy.js';

describe('public legal documents', () => {
  it('publishes versioned privacy, terms and health consent with required disclosures', () => {
    expect(PUBLIC_PRIVACY_DOCUMENTS.map((document) => document.version)).toEqual([
      '2026-07-15',
      '2026-07-15',
      '2026-07-15',
    ]);
    const privacy = PUBLIC_PRIVACY_DOCUMENTS.find(
      (document) => document.type === 'privacy_notice',
    )!;
    expect(privacy.content).toMatch(/controlador/i);
    expect(privacy.content).toMatch(/finalidades/i);
    expect(privacy.content).toMatch(/retenção/i);
    expect(privacy.content).toMatch(/exportar|exclusão/i);
    expect(privacy.content).toMatch(/backup/i);

    const terms = PUBLIC_PRIVACY_DOCUMENTS.find((document) => document.type === 'terms')!;
    expect(terms.content).toMatch(/não substitui/i);
    expect(terms.content).toMatch(/conta/i);
    expect(terms.content).toMatch(/disponibilidade/i);

    const consent = PUBLIC_PRIVACY_DOCUMENTS.find(
      (document) => document.type === 'health_data_consent',
    )!;
    expect(consent.content).toMatch(/revogar/i);
    expect(consent.content).toMatch(/treino|medidas|dor/i);
  });
});
