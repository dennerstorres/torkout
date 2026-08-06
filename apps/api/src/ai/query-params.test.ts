import { describe, expect, it } from 'vitest';

import { AiRequestError } from './operations.js';
import {
  parseComparePeriodsQuery,
  parseExercise,
  parseLimit,
  parseRangeQuery,
  parseStatus,
} from './query-params.js';

describe('parseRangeQuery', () => {
  it('devolve objeto vazio quando nada foi pedido', () => {
    expect(parseRangeQuery({})).toEqual({});
  });

  it('converte `days` para número', () => {
    expect(parseRangeQuery({ days: '14' })).toEqual({ days: 14 });
  });

  it('mantém as datas civis como texto, para o schema validá-las', () => {
    expect(parseRangeQuery({ from: '2026-07-24', to: '2026-08-06' })).toEqual({
      from: '2026-07-24',
      to: '2026-08-06',
    });
  });

  it('trata parâmetro em branco como ausente, e não como valor inválido', () => {
    expect(parseRangeQuery({ days: '   ', from: '' })).toEqual({});
  });

  it('recusa `days` que não é inteiro', () => {
    for (const days of ['sete', '1.5', '7d', '']) {
      if (days === '') continue;
      expect(() => parseRangeQuery({ days })).toThrow(AiRequestError);
    }
  });

  it('recusa o mesmo parâmetro informado duas vezes', () => {
    expect(() => parseRangeQuery({ days: ['7', '14'] })).toThrow(AiRequestError);
  });
});

describe('parseLimit', () => {
  it('converte o limite e ignora a ausência', () => {
    expect(parseLimit({ limit: '50' })).toEqual({ limit: 50 });
    expect(parseLimit({})).toEqual({});
  });

  it('recusa um limite não numérico', () => {
    expect(() => parseLimit({ limit: 'muitos' })).toThrow(AiRequestError);
  });
});

describe('parseExercise', () => {
  it('exige o exercício quando ele é obrigatório', () => {
    expect(() => parseExercise({}, true)).toThrow(AiRequestError);
    expect(parseExercise({}, false)).toEqual({});
  });

  it('remove espaço em volta do nome', () => {
    expect(parseExercise({ exercise: '  Flexão ' }, true)).toEqual({ exercise: 'Flexão' });
  });
});

describe('parseStatus', () => {
  it('repassa o estado para o schema validar', () => {
    expect(parseStatus({ status: 'completed' })).toEqual({ status: 'completed' });
    expect(parseStatus({})).toEqual({});
  });
});

describe('parseComparePeriodsQuery', () => {
  it('exige os quatro limites', () => {
    expect(() => parseComparePeriodsQuery({ current_from: '2026-08-01' })).toThrow(AiRequestError);
  });

  it('devolve os quatro limites quando todos vieram', () => {
    expect(
      parseComparePeriodsQuery({
        current_from: '2026-08-01',
        current_to: '2026-08-14',
        previous_from: '2026-07-18',
        previous_to: '2026-07-31',
      }),
    ).toEqual({
      current_from: '2026-08-01',
      current_to: '2026-08-14',
      previous_from: '2026-07-18',
      previous_to: '2026-07-31',
    });
  });
});
