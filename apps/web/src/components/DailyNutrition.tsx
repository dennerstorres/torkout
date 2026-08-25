import { useId, useState, type FormEvent } from 'react';

import {
  queueLocalMutation,
  type LocalRecord,
  type UserSyncDatabase,
} from '../sync/local-database';
import {
  coffeeStatusLabel,
  proteinFormatLabel,
  proteinServingLabel,
  wheyMixLabel,
  wheyMomentLabel,
  wheyToleranceLabel,
} from '../presentation';

type CoffeeStatus = 'not_consumed' | 'without_sugar' | 'with_sugar';
type ProteinFormat = 'powder' | 'ready_to_drink' | 'yogurt';
type ProteinServingUnit = 'scoop' | 'tablespoon';
type WheyMixBase = 'water' | 'whole_milk' | 'semi_skimmed_milk' | 'skimmed_milk' | 'other';
type WheyMoment = 'morning' | 'pre_workout' | 'post_workout' | 'night' | 'other';
type WheyTolerance = 'none' | 'gas' | 'bloating' | 'cramp' | 'diarrhea' | 'nausea' | 'other';

const COFFEE_STATUSES: CoffeeStatus[] = ['not_consumed', 'without_sugar', 'with_sugar'];
const PROTEIN_FORMATS: ProteinFormat[] = ['powder', 'ready_to_drink', 'yogurt'];
/** Só o pó é dosado por scoop ou colher; garrafa e pote são contados por unidade consumida. */
const POWDER_SERVING_UNITS: ProteinServingUnit[] = ['scoop', 'tablespoon'];
const WHEY_MIXES: WheyMixBase[] = [
  'water',
  'whole_milk',
  'semi_skimmed_milk',
  'skimmed_milk',
  'other',
];
const WHEY_MOMENTS: WheyMoment[] = ['morning', 'pre_workout', 'post_workout', 'night', 'other'];
const WHEY_TOLERANCES: WheyTolerance[] = [
  'none',
  'gas',
  'bloating',
  'cramp',
  'diarrhea',
  'nausea',
  'other',
];

interface DailyNutritionProps {
  database: UserSyncDatabase;
  localDate: string;
  now?: Date;
  onSaved?(message: string): void;
  records: LocalRecord[];
}

interface WheyDraft {
  blendedWith: string;
  brand: string;
  consumed: boolean;
  customMixedWith: string;
  format: ProteinFormat;
  liquidMl: string;
  localTime: string;
  mixedWith: WheyMixBase | '';
  moment: WheyMoment | '';
  notes: string;
  powderGrams: string;
  product: string;
  proteinPerServingGrams: string;
  servingUnit: ProteinServingUnit;
  servings: string;
  tolerance: WheyTolerance[];
}

function emptyDraft(now: Date): WheyDraft {
  return {
    blendedWith: '',
    brand: '',
    consumed: true,
    customMixedWith: '',
    format: 'powder',
    liquidMl: '',
    localTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    mixedWith: '',
    moment: '',
    notes: '',
    powderGrams: '',
    product: '',
    proteinPerServingGrams: '',
    servingUnit: 'scoop',
    servings: '',
    tolerance: [],
  };
}

/**
 * Uma linha por registro do dia. O formato só aparece quando não é pó, para a lista não repetir o
 * caso mais comum, e a medida vem por extenso para scoop e colher nunca se confundirem.
 */
function describeIntake(data: Record<string, unknown>): string {
  if (data.consumed === false) return 'Não consumi';
  const format = typeof data.format === 'string' ? data.format : 'powder';
  const parts: string[] = [];
  if (format !== 'powder') parts.push(proteinFormatLabel(format));
  if (typeof data.powderGrams === 'number') parts.push(`${data.powderGrams} g`);
  if (typeof data.servings === 'number' && typeof data.servingUnit === 'string') {
    parts.push(proteinServingLabel(data.servings, data.servingUnit));
  }
  if (typeof data.mixedWith === 'string') parts.push(wheyMixLabel(data.mixedWith));
  if (typeof data.blendedWith === 'string') parts.push(`com ${data.blendedWith}`);
  return parts.length === 0 ? 'Consumi' : parts.join(' · ');
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function DailyNutrition({
  database,
  localDate,
  now = new Date(),
  onSaved,
  records,
}: DailyNutritionProps) {
  const coffeeName = useId();
  const [draft, setDraft] = useState<WheyDraft>(() => emptyDraft(now));
  const [showWheyForm, setShowWheyForm] = useState(false);

  const coffeeRecord = records.find(
    (record) =>
      record.entityType === 'coffee_intake' &&
      record.deletedAt === null &&
      record.data.localDate === localDate,
  );
  const coffeeStatus =
    typeof coffeeRecord?.data.status === 'string'
      ? (coffeeRecord.data.status as CoffeeStatus)
      : null;
  const wheyRecords = records.filter(
    (record) =>
      record.entityType === 'whey_intake' &&
      record.deletedAt === null &&
      record.data.localDate === localDate,
  );

  async function saveCoffee(status: CoffeeStatus): Promise<void> {
    await queueLocalMutation(
      database,
      coffeeRecord
        ? {
            entityId: coffeeRecord.entityId,
            entityType: 'coffee_intake',
            operation: 'update',
            payload: { status },
          }
        : {
            entityId: crypto.randomUUID(),
            entityType: 'coffee_intake',
            operation: 'create',
            payload: { localDate, recordedAt: now.toISOString(), status },
          },
    );
    onSaved?.('Salvo localmente: café pendente de sincronização.');
  }

  async function saveWhey(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const payload: Record<string, unknown> = {
      consumed: draft.consumed,
      localDate,
      tolerance: draft.tolerance,
    };
    if (draft.localTime) payload.localTime = draft.localTime;
    if (draft.notes.trim()) payload.notes = draft.notes.trim();
    if (draft.consumed) {
      payload.format = draft.format;
      const servings = optionalNumber(draft.servings);
      const protein = optionalNumber(draft.proteinPerServingGrams);
      if (servings !== undefined) {
        payload.servings = servings;
        // A medida acompanha a quantidade: sozinha ela não diz nada e o servidor recusa.
        payload.servingUnit = draft.format === 'powder' ? draft.servingUnit : 'unit';
      }
      if (protein !== undefined) payload.proteinPerServingGrams = protein;
      if (draft.format === 'powder') {
        const powderGrams = optionalNumber(draft.powderGrams);
        const liquidMl = optionalNumber(draft.liquidMl);
        if (powderGrams !== undefined) payload.powderGrams = powderGrams;
        if (liquidMl !== undefined) payload.liquidMl = liquidMl;
        if (draft.mixedWith) payload.mixedWith = draft.mixedWith;
        if (draft.mixedWith === 'other' && draft.customMixedWith.trim())
          payload.customMixedWith = draft.customMixedWith.trim();
        if (draft.blendedWith.trim()) payload.blendedWith = draft.blendedWith.trim();
      }
      if (draft.moment) payload.moment = draft.moment;
      if (draft.brand.trim()) payload.brand = draft.brand.trim();
      if (draft.product.trim()) payload.product = draft.product.trim();
    }
    await queueLocalMutation(database, {
      entityId: crypto.randomUUID(),
      entityType: 'whey_intake',
      operation: 'create',
      payload,
    });
    setDraft(emptyDraft(now));
    setShowWheyForm(false);
    onSaved?.('Salvo localmente: proteína pendente de sincronização.');
  }

  function toggleTolerance(value: WheyTolerance): void {
    setDraft((state) => {
      if (value === 'none') {
        return { ...state, tolerance: state.tolerance.includes('none') ? [] : ['none'] };
      }
      const withoutNone = state.tolerance.filter((item) => item !== 'none');
      return {
        ...state,
        tolerance: withoutNone.includes(value)
          ? withoutNone.filter((item) => item !== value)
          : [...withoutNone, value],
      };
    });
  }

  return (
    <>
      <section className="card today-section" aria-labelledby="coffee-heading">
        <h2 id="coffee-heading">Café de hoje</h2>
        <fieldset className="choice-group" role="radiogroup" aria-label="Café de hoje">
          <legend className="visually-hidden">Café de hoje</legend>
          {COFFEE_STATUSES.map((status) => (
            <label className="inline-check" key={status}>
              <input
                checked={coffeeStatus === status}
                name={coffeeName}
                type="radio"
                value={status}
                onChange={() => void saveCoffee(status)}
              />
              {coffeeStatusLabel(status)}
            </label>
          ))}
        </fieldset>
        {coffeeStatus === null && (
          <p className="field-hint">
            Café ainda não registrado hoje. A ausência de registro não significa que você não tomou
            café.
          </p>
        )}
      </section>

      <section className="card today-section" aria-labelledby="whey-heading">
        <h2 id="whey-heading">Proteína de hoje</h2>
        {wheyRecords.length === 0 && !showWheyForm && (
          <p className="field-hint">Nenhum registro de proteína hoje.</p>
        )}
        {wheyRecords.length > 0 && (
          <ul className="record-list">
            {wheyRecords.map((record) => (
              <li key={record.entityId}>
                {typeof record.data.localTime === 'string' ? `${record.data.localTime} · ` : ''}
                {describeIntake(record.data)}
                {Array.isArray(record.data.tolerance) && record.data.tolerance.length > 0
                  ? ` · ${(record.data.tolerance as string[]).map(wheyToleranceLabel).join(', ')}`
                  : ''}
              </li>
            ))}
          </ul>
        )}
        {!showWheyForm ? (
          <button type="button" onClick={() => setShowWheyForm(true)}>
            Registrar proteína
          </button>
        ) : (
          <form onSubmit={(event) => void saveWhey(event)}>
            <fieldset className="choice-group" role="radiogroup" aria-label="Consumiu proteína?">
              <legend>Consumiu proteína?</legend>
              <label className="inline-check">
                <input
                  checked={draft.consumed}
                  name={`${coffeeName}-whey-consumed`}
                  type="radio"
                  onChange={() => setDraft((state) => ({ ...state, consumed: true }))}
                />
                Sim
              </label>
              <label className="inline-check">
                <input
                  checked={!draft.consumed}
                  name={`${coffeeName}-whey-consumed`}
                  type="radio"
                  onChange={() => setDraft((state) => ({ ...state, consumed: false }))}
                />
                Não
              </label>
            </fieldset>
            <label>
              Horário
              <input
                type="time"
                value={draft.localTime}
                onChange={(event) =>
                  setDraft((state) => ({ ...state, localTime: event.target.value }))
                }
              />
            </label>
            {draft.consumed && (
              <>
                <label>
                  Tipo
                  <select
                    value={draft.format}
                    onChange={(event) =>
                      setDraft((state) => ({
                        ...state,
                        // Trocar de formato limpa o preparo do pó: garrafa e pote não têm líquido,
                        // gramas nem vitamina, e o servidor recusa o resto que ficasse para trás.
                        blendedWith: '',
                        customMixedWith: '',
                        format: event.target.value as ProteinFormat,
                        liquidMl: '',
                        mixedWith: '',
                        powderGrams: '',
                      }))
                    }
                  >
                    {PROTEIN_FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {proteinFormatLabel(format)}
                      </option>
                    ))}
                  </select>
                </label>
                {draft.format === 'powder' && (
                  <label>
                    Quantidade de pó (g)
                    <input
                      min="0"
                      step="0.5"
                      type="number"
                      value={draft.powderGrams}
                      onChange={(event) =>
                        setDraft((state) => ({ ...state, powderGrams: event.target.value }))
                      }
                    />
                  </label>
                )}
                <label>
                  Quantidade de porções (opcional)
                  <input
                    min="0"
                    step="0.5"
                    type="number"
                    value={draft.servings}
                    onChange={(event) =>
                      setDraft((state) => ({ ...state, servings: event.target.value }))
                    }
                  />
                </label>
                {draft.format === 'powder' && (
                  <label>
                    Medida
                    <select
                      value={draft.servingUnit}
                      onChange={(event) =>
                        setDraft((state) => ({
                          ...state,
                          servingUnit: event.target.value as ProteinServingUnit,
                        }))
                      }
                    >
                      {POWDER_SERVING_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {proteinServingLabel(1, unit).replace('1 ', '')}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Proteína informada por porção (g, opcional)
                  <input
                    min="0"
                    step="0.1"
                    type="number"
                    value={draft.proteinPerServingGrams}
                    onChange={(event) =>
                      setDraft((state) => ({
                        ...state,
                        proteinPerServingGrams: event.target.value,
                      }))
                    }
                  />
                </label>
                {draft.format === 'powder' && (
                  <>
                    <label>
                      Misturado com
                      <select
                        value={draft.mixedWith}
                        onChange={(event) =>
                          setDraft((state) => ({
                            ...state,
                            customMixedWith: '',
                            mixedWith: event.target.value as WheyMixBase | '',
                          }))
                        }
                      >
                        <option value="">Não informado</option>
                        {WHEY_MIXES.map((mix) => (
                          <option key={mix} value={mix}>
                            {wheyMixLabel(mix)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {draft.mixedWith === 'other' && (
                      <label>
                        Qual líquido
                        <input
                          value={draft.customMixedWith}
                          onChange={(event) =>
                            setDraft((state) => ({ ...state, customMixedWith: event.target.value }))
                          }
                        />
                      </label>
                    )}
                    <label>
                      Quantidade do líquido (ml)
                      <input
                        min="0"
                        type="number"
                        value={draft.liquidMl}
                        onChange={(event) =>
                          setDraft((state) => ({ ...state, liquidMl: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Batido com (opcional)
                      <input
                        placeholder="Banana e abacate"
                        value={draft.blendedWith}
                        onChange={(event) =>
                          setDraft((state) => ({ ...state, blendedWith: event.target.value }))
                        }
                      />
                    </label>
                  </>
                )}
                <label>
                  Marca (opcional)
                  <input
                    value={draft.brand}
                    onChange={(event) =>
                      setDraft((state) => ({ ...state, brand: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Produto ou sabor (opcional)
                  <input
                    value={draft.product}
                    onChange={(event) =>
                      setDraft((state) => ({ ...state, product: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Momento
                  <select
                    value={draft.moment}
                    onChange={(event) =>
                      setDraft((state) => ({
                        ...state,
                        moment: event.target.value as WheyMoment | '',
                      }))
                    }
                  >
                    <option value="">Não informado</option>
                    {WHEY_MOMENTS.map((moment) => (
                      <option key={moment} value={moment}>
                        {wheyMomentLabel(moment)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <fieldset className="choice-group">
              <legend>Tolerância</legend>
              {WHEY_TOLERANCES.map((tolerance) => (
                <label className="inline-check" key={tolerance}>
                  <input
                    checked={draft.tolerance.includes(tolerance)}
                    type="checkbox"
                    onChange={() => toggleTolerance(tolerance)}
                  />
                  {wheyToleranceLabel(tolerance)}
                </label>
              ))}
            </fieldset>
            <label>
              Observações da proteína
              <textarea
                value={draft.notes}
                onChange={(event) => setDraft((state) => ({ ...state, notes: event.target.value }))}
              />
            </label>
            <div className="button-row">
              <button className="primary" type="submit">
                Salvar registro de proteína
              </button>
              <button type="button" onClick={() => setShowWheyForm(false)}>
                Cancelar registro de proteína
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
