import { describe, expect, it } from 'vitest';

import { instantToLocalDate, localDateTimeToInstant, validateIanaTimeZone } from './time.js';

describe('time contracts', () => {
  it('resolves dates on both sides of local midnight', () => {
    expect(instantToLocalDate('2026-07-14T03:59:59Z', 'America/Cuiaba')).toBe('2026-07-13');
    expect(instantToLocalDate('2026-07-14T04:00:00Z', 'America/Cuiaba')).toBe('2026-07-14');
  });

  it('converts a local schedule using its recorded IANA time zone', () => {
    expect(localDateTimeToInstant('2026-07-14', '18:00:00', 'America/Cuiaba')).toBe(
      '2026-07-14T22:00:00Z',
    );
  });

  it('rejects an invalid IANA time zone', () => {
    expect(() => validateIanaTimeZone('GMT-4-ish')).toThrow('Fuso horário IANA inválido');
  });

  it('rejects a local wall-clock time skipped by daylight saving transitions', () => {
    expect(() => localDateTimeToInstant('2018-11-04', '00:30:00', 'America/Sao_Paulo')).toThrow(
      'Data e hora local inexistente ou ambígua',
    );
  });
});
