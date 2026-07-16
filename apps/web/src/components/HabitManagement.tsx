import { useState, type FormEvent } from 'react';

import {
  queueLocalMutation,
  type LocalRecord,
  type UserSyncDatabase,
} from '../sync/local-database';

type HabitType = 'boolean' | 'choice' | 'quantity' | 'scale';

interface HabitOptionDraft {
  id?: string;
  label: string;
  stableValue: string;
}

interface Props {
  database: UserSyncDatabase;
  habitEntries: LocalRecord[];
  habits: LocalRecord[];
  onChanged(message: string): Promise<void>;
}

const typeLabels: Record<HabitType, string> = {
  boolean: 'Sim ou não',
  choice: 'Escolha',
  quantity: 'Quantidade',
  scale: 'Escala numérica',
};

function blankOptions(): HabitOptionDraft[] {
  return [
    { label: '', stableValue: crypto.randomUUID() },
    { label: '', stableValue: crypto.randomUUID() },
  ];
}

function stringField(data: Record<string, unknown>, key: string, fallback = ''): string {
  return typeof data[key] === 'string' ? data[key] : fallback;
}

function optionsOf(record: LocalRecord): HabitOptionDraft[] {
  if (!Array.isArray(record.data.options)) return blankOptions();
  return record.data.options.map((value) => {
    const option = value as Record<string, unknown>;
    const id = stringField(option, 'id');
    return {
      ...(id ? { id } : {}),
      label: stringField(option, 'label'),
      stableValue: stringField(option, 'stableValue', crypto.randomUUID()),
    };
  });
}

export function HabitManagement({ database, habitEntries, habits, onChanged }: Props) {
  const [editing, setEditing] = useState<LocalRecord | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<HabitType>('boolean');
  const [unit, setUnit] = useState('');
  const [options, setOptions] = useState<HabitOptionDraft[]>(blankOptions);

  function resetForm(): void {
    setEditing(null);
    setName('');
    setType('boolean');
    setUnit('');
    setOptions(blankOptions());
  }

  function beginEditing(habit: LocalRecord): void {
    const habitType = stringField(habit.data, 'type', 'boolean') as HabitType;
    setEditing(habit);
    setName(stringField(habit.data, 'name'));
    setType(habitType);
    setUnit(stringField(habit.data, 'unit'));
    setOptions(habitType === 'choice' ? optionsOf(habit) : blankOptions());
  }

  function changeType(nextType: HabitType): void {
    setType(nextType);
    if (nextType === 'choice' && options.length < 2) setOptions(blankOptions());
  }

  function changeOption(index: number, label: string): void {
    setOptions((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? { ...option, label } : option)),
    );
  }

  async function saveHabit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const choiceOptions =
      type === 'choice'
        ? options
            .filter((option) => option.label.trim())
            .map((option, sortOrder) => ({
              ...(option.id ? { id: option.id } : {}),
              label: option.label.trim(),
              sortOrder,
              stableValue: option.stableValue,
            }))
        : [];
    const payload = {
      active: editing ? editing.data.active !== false : true,
      name: name.trim(),
      options: choiceOptions,
      sortOrder: editing
        ? typeof editing.data.sortOrder === 'number'
          ? editing.data.sortOrder
          : 0
        : habits.length,
      type,
      unit: type === 'quantity' || type === 'scale' ? unit.trim() || null : null,
    };
    await queueLocalMutation(database, {
      entityId: editing?.entityId ?? crypto.randomUUID(),
      entityType: 'habit_definition',
      operation: editing ? 'update' : 'create',
      payload,
    });
    resetForm();
    await onChanged(
      editing
        ? 'Hábito atualizado localmente e pendente de sincronização.'
        : 'Hábito adicionado localmente e pendente de sincronização.',
    );
  }

  async function toggleHabit(habit: LocalRecord): Promise<void> {
    const active = habit.data.active === false;
    await queueLocalMutation(database, {
      entityId: habit.entityId,
      entityType: 'habit_definition',
      operation: 'update',
      payload: { active },
    });
    await onChanged(active ? 'Hábito ativado localmente.' : 'Hábito desativado localmente.');
  }

  async function deleteHabit(habit: LocalRecord): Promise<void> {
    const habitName = stringField(habit.data, 'name', 'este hábito');
    if (!window.confirm(`Excluir ${habitName}? Os registros históricos serão preservados.`)) return;
    await queueLocalMutation(database, {
      entityId: habit.entityId,
      entityType: 'habit_definition',
      operation: 'delete',
      payload: {},
    });
    if (editing?.entityId === habit.entityId) resetForm();
    await onChanged('Hábito excluído localmente; o histórico foi preservado.');
  }

  return (
    <section
      className="card planning-section habit-management"
      aria-labelledby="habits-management-heading"
    >
      <p className="eyebrow">Rotina diária</p>
      <h2 id="habits-management-heading">Hábitos diários</h2>
      <p className="field-hint">
        Hábitos inativos deixam de aparecer em Hoje, mas continuam identificados no histórico.
      </p>

      {habits.length === 0 ? (
        <p>Nenhum hábito cadastrado.</p>
      ) : (
        <ul className="habit-management-list">
          {habits.map((habit) => {
            const habitName = stringField(habit.data, 'name', 'Hábito');
            const habitType = stringField(habit.data, 'type', 'boolean') as HabitType;
            const active = habit.data.active !== false;
            const hasHistory = habitEntries.some(
              (entry) => entry.data.habitDefinitionId === habit.entityId,
            );
            return (
              <li key={habit.entityId}>
                <div>
                  <strong>{habitName}</strong>
                  <span>{typeLabels[habitType] ?? 'Hábito'}</span>
                  <span>{active ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div className="button-row">
                  <button type="button" onClick={() => beginEditing(habit)}>
                    Editar {habitName}
                  </button>
                  <button type="button" onClick={() => void toggleHabit(habit)}>
                    {active ? 'Desativar' : 'Ativar'} {habitName}
                  </button>
                  <button
                    className="danger"
                    disabled={hasHistory}
                    title={hasHistory ? 'Desative o hábito para preservar o histórico.' : undefined}
                    type="button"
                    onClick={() => void deleteHabit(habit)}
                  >
                    Excluir {habitName}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        aria-label={editing ? `Editar ${stringField(editing.data, 'name')}` : 'Novo hábito diário'}
        onSubmit={(event) => void saveHabit(event)}
      >
        <label>
          Nome do hábito
          <input
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Tipo de hábito
          <select value={type} onChange={(event) => changeType(event.target.value as HabitType)}>
            <option value="boolean">Sim ou não</option>
            <option value="quantity">Quantidade</option>
            <option value="scale">Escala numérica</option>
            <option value="choice">Escolha entre opções</option>
          </select>
        </label>
        {(type === 'quantity' || type === 'scale') && (
          <label>
            Unidade (opcional)
            <input
              maxLength={40}
              placeholder="Ex.: copos, porções"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
            />
          </label>
        )}
        {type === 'choice' && (
          <fieldset className="habit-options-editor">
            <legend>Opções de resposta</legend>
            {options.map((option, index) => (
              <div className="habit-option-row" key={option.stableValue}>
                <label>
                  Opção {index + 1}
                  <input
                    required
                    value={option.label}
                    onChange={(event) => changeOption(index, event.target.value)}
                  />
                </label>
                {options.length > 2 && !option.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((current) => current.filter((_, item) => item !== index))
                    }
                  >
                    Remover opção {index + 1}
                  </button>
                )}
              </div>
            ))}
            {options.length < 30 && (
              <button
                type="button"
                onClick={() =>
                  setOptions((current) => [
                    ...current,
                    { label: '', stableValue: crypto.randomUUID() },
                  ])
                }
              >
                Adicionar opção
              </button>
            )}
          </fieldset>
        )}
        <div className="button-row">
          <button className="primary" type="submit">
            {editing ? 'Salvar alterações' : 'Adicionar hábito'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
