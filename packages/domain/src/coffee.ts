/**
 * Consumo de café é registrado de forma explícita: "não consumi" nunca é inferido a partir da
 * ausência de açúcar nem da ausência de registro.
 */
export const COFFEE_STATUS_VALUES = ['not_consumed', 'without_sugar', 'with_sugar'] as const;

export type CoffeeStatus = (typeof COFFEE_STATUS_VALUES)[number];

const COFFEE_STATUS_LABELS: Record<CoffeeStatus, string> = {
  not_consumed: 'Não consumi',
  with_sugar: 'Com açúcar',
  without_sugar: 'Sem açúcar',
};

export function coffeeStatusLabel(value: CoffeeStatus | null | undefined): string {
  return value ? COFFEE_STATUS_LABELS[value] : 'Não registrado';
}

/**
 * - `exact`: o registro antigo descreve o estado sem ambiguidade.
 * - `consumed_unknown_sugar`: houve consumo, mas o açúcar não foi registrado.
 * - `ambiguous`: o registro antigo não permite concluir nada; nunca vira "não consumi".
 * - `not_coffee`: o registro não fala de café.
 */
export type LegacyCoffeeConfidence =
  'ambiguous' | 'consumed_unknown_sugar' | 'exact' | 'not_coffee';

export interface LegacyCoffeeRecordInput {
  booleanValue?: boolean | null | undefined;
  habitName: string;
  numericValue?: number | null | undefined;
  optionLabel?: string | null | undefined;
  textValue?: string | null | undefined;
}

export interface LegacyCoffeeMapping {
  confidence: LegacyCoffeeConfidence;
  status: CoffeeStatus | null;
}

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function sugarHintOf(text: string): CoffeeStatus | null {
  if (/\bsem\s+acucar\b|\bs\/\s*acucar\b|\bzero\s+acucar\b|\bpuro\b/.test(text))
    return 'without_sugar';
  if (/\bcom\s+acucar\b|\bc\/\s*acucar\b|\badocad/.test(text)) return 'with_sugar';
  return null;
}

function isNegativeAnswer(text: string): boolean {
  return /^(nao|n)\b|\bnao (consumi|tomei|bebi|tomou)\b|\bnenhum\b|\bnao consumido\b/.test(text);
}

export function mapLegacyCoffeeRecord(input: LegacyCoffeeRecordInput): LegacyCoffeeMapping {
  const habitName = normalize(input.habitName);
  if (!/\bcafe\b|\bcafezinho\b/.test(habitName)) {
    return { confidence: 'not_coffee', status: null };
  }

  const answer = normalize(input.optionLabel ?? input.textValue ?? '');
  if (answer) {
    if (isNegativeAnswer(answer)) return { confidence: 'exact', status: 'not_consumed' };
    const hint = sugarHintOf(answer);
    if (hint) return { confidence: 'exact', status: hint };
    return { confidence: 'ambiguous', status: null };
  }

  const nameHint = sugarHintOf(habitName);
  if (input.booleanValue === true) {
    return nameHint
      ? { confidence: 'exact', status: nameHint }
      : { confidence: 'consumed_unknown_sugar', status: null };
  }
  if (input.booleanValue === false) {
    // "Café sem açúcar = não" pode significar que houve café com açúcar; jamais assumir ausência.
    return nameHint
      ? { confidence: 'ambiguous', status: null }
      : { confidence: 'exact', status: 'not_consumed' };
  }

  if (typeof input.numericValue === 'number') {
    if (input.numericValue === 0) return { confidence: 'exact', status: 'not_consumed' };
    return nameHint
      ? { confidence: 'exact', status: nameHint }
      : { confidence: 'consumed_unknown_sugar', status: null };
  }

  return { confidence: 'ambiguous', status: null };
}

export interface CoffeeSummary {
  days: number;
  notConsumed: number;
  unclassified: number;
  withSugar: number;
  withoutSugar: number;
}

export function summarizeCoffee(
  entries: Array<{ localDate: string; status: CoffeeStatus | null }>,
): CoffeeSummary {
  const summary: CoffeeSummary = {
    days: entries.length,
    notConsumed: 0,
    unclassified: 0,
    withSugar: 0,
    withoutSugar: 0,
  };
  for (const entry of entries) {
    if (entry.status === 'not_consumed') summary.notConsumed += 1;
    else if (entry.status === 'without_sugar') summary.withoutSugar += 1;
    else if (entry.status === 'with_sugar') summary.withSugar += 1;
    else summary.unclassified += 1;
  }
  return summary;
}
