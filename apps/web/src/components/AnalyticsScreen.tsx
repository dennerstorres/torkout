import type { ProgressAnalyticsResponse } from '@torkout/contracts';
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';

import type { UserSyncDatabase } from '../sync/local-database';

interface AnalyticsScreenProps {
  database: UserSyncDatabase;
  onBack(): void;
  onLoad?(from: string, through: string): Promise<ProgressAnalyticsResponse>;
  onProgression?(): void;
  today?: string;
}

export function AnalyticsScreen(_props: AnalyticsScreenProps) {
  const {
    database,
    onBack,
    onLoad,
    onProgression,
    today = new Date().toISOString().slice(0, 10),
  } = _props;
  const [preset, setPreset] = useState<'4' | '8' | '12' | 'custom'>('4');
  const [customFrom, setCustomFrom] = useState(today);
  const [customThrough, setCustomThrough] = useState(today);
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; through: string } | null>(
    null,
  );
  const [analytics, setAnalytics] = useState<ProgressAnalyticsResponse | null>(null);
  const [message, setMessage] = useState('Carregando indicadores…');
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (preset === 'custom' && appliedCustom) return appliedCustom;
    if (preset === 'custom') return null;
    return { from: addDays(today, -(Number(preset) * 7 - 1)), through: today };
  }, [appliedCustom, preset, today]);

  useEffect(() => {
    if (!range) return;
    let active = true;
    const key = `${range.from}:${range.through}`;
    void (async () => {
      setLoading(true);
      try {
        if (!onLoad) throw new Error('OFFLINE');
        const response = await onLoad(range.from, range.through);
        await database.analyticsCache.put({
          cachedAt: new Date().toISOString(),
          from: range.from,
          key,
          response,
          through: range.through,
        });
        if (active) {
          setAnalytics(response);
          setMessage('Indicadores atualizados e salvos neste dispositivo.');
        }
      } catch {
        const cached = await database.analyticsCache.get(key).catch(() => undefined);
        if (active) {
          setAnalytics(cached?.response ?? null);
          setMessage(
            cached
              ? 'Exibindo a última análise salva neste dispositivo.'
              : 'Nenhuma análise deste período está disponível offline.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [database, onLoad, range]);

  return (
    <main className="analytics-layout">
      <header className="analytics-header">
        <button className="back-button" type="button" onClick={onBack}>
          Voltar
        </button>
        <div>
          <p className="eyebrow">Indicadores pessoais</p>
          <h1>Progresso</h1>
          <p>Os indicadores resumem seus registros; eles não substituem orientação profissional.</p>
        </div>
        {onProgression && (
          <button className="primary" type="button" onClick={onProgression}>
            Ver sugestões de progressão
          </button>
        )}
      </header>

      <section className="card analytics-filters" aria-labelledby="analytics-filter-title">
        <h2 id="analytics-filter-title">Período</h2>
        <div className="button-row" aria-label="Períodos rápidos">
          {(['4', '8', '12'] as const).map((weeks) => (
            <button
              aria-pressed={preset === weeks}
              key={weeks}
              type="button"
              onClick={() => setPreset(weeks)}
            >
              {weeks} semanas
            </button>
          ))}
          <button
            aria-pressed={preset === 'custom'}
            type="button"
            onClick={() => setPreset('custom')}
          >
            Personalizado
          </button>
        </div>
        {preset === 'custom' && (
          <form
            className="analytics-custom-range"
            onSubmit={(event) => {
              event.preventDefault();
              if (customThrough < customFrom) {
                setMessage('A data final não pode anteceder a inicial.');
                return;
              }
              setAppliedCustom({ from: customFrom, through: customThrough });
            }}
          >
            <label>
              Data inicial
              <input
                max={customThrough}
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
            </label>
            <label>
              Data final
              <input
                max={today}
                min={customFrom}
                type="date"
                value={customThrough}
                onChange={(event) => setCustomThrough(event.target.value)}
              />
            </label>
            <button className="primary" type="submit">
              Aplicar período
            </button>
          </form>
        )}
      </section>

      <p className="sync-note" role="status" aria-live="polite">
        {loading ? 'Carregando indicadores…' : message}
      </p>

      {analytics && <AnalyticsContent analytics={analytics} />}
    </main>
  );
}

const DAY_MS = 86_400_000;

function addDays(localDate: string, amount: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00Z`) + amount * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function dateLabel(localDate: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(`${localDate}T12:00:00Z`),
  );
}

function numberLabel(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(value);
}

function AnalyticsContent({ analytics }: { analytics: ProgressAnalyticsResponse }) {
  const weight = analytics.measurements
    .filter((point) => point.weightKg !== null)
    .map((point) => ({ date: point.localDate, value: point.weightKg! }));
  const waist = analytics.measurements
    .filter((point) => point.waistCm !== null)
    .map((point) => ({ date: point.localDate, value: point.waistCm! }));
  const consistency = analytics.consistency.weeks
    .filter((week) => week.percentage !== null)
    .map((week) => ({ date: week.weekStart, value: week.percentage! }));
  const noSessions = analytics.sessions.completed === 0 && analytics.sessions.partial === 0;

  return (
    <div className="analytics-grid">
      <section className="card analytics-summary">
        <h2>Resumo do período</h2>
        <p>
          {dateLabel(analytics.range.from)} a {dateLabel(analytics.range.through)} (datas
          inclusivas)
        </p>
        {noSessions && <p>Nenhum treino registrado no período.</p>}
        <dl className="indicator-grid">
          <div>
            <dt>Treinos concluídos</dt>
            <dd>{analytics.sessions.completed}</dd>
          </div>
          <div>
            <dt>Treinos parciais</dt>
            <dd>{analytics.sessions.partial}</dd>
          </div>
          <div>
            <dt>Caminhadas concluídas ou parciais</dt>
            <dd>{analytics.walks.sessions}</dd>
          </div>
          <div>
            <dt>Distância caminhada</dt>
            <dd>{numberLabel(analytics.walks.distanceMeters / 1000)} km</dd>
          </div>
          <div>
            <dt>Frequência de caminhada</dt>
            <dd>{numberLabel(analytics.walks.frequencyPerWeek)} por semana</dd>
          </div>
        </dl>
        <p className="field-hint">
          Caminhadas contam sessões concluídas ou parciais; a frequência é o total dividido pelas
          semanas civis tocadas pelo período.
        </p>
      </section>

      <AccessibleLineChart
        name="Evolução do peso"
        points={weight}
        tableName="Dados de evolução do peso"
        unit="kg"
      />
      <AccessibleLineChart
        name="Evolução da cintura"
        points={waist}
        tableName="Dados de evolução da cintura"
        unit="cm"
      />
      <AccessibleLineChart
        description={analytics.consistency.explanation}
        name="Consistência semanal"
        points={consistency}
        tableName="Dados de consistência semanal"
        unit="%"
      />
      <p className="analytics-formula-version">
        Versão da fórmula: <code>{analytics.consistency.formulaVersion}</code>
      </p>

      <section className="card analytics-summary">
        <h2>Exercícios</h2>
        {analytics.exercises.length === 0 && <p>Dados insuficientes para totais por exercício.</p>}
        {analytics.exercises.map((exercise) => (
          <div className="exercise-analytics" key={`${exercise.exerciseId}:${exercise.metric}`}>
            <p>
              <strong>{exercise.name}:</strong> {numberLabel(exercise.total)}{' '}
              {metricUnit(exercise.metric)}
            </p>
            <AccessibleLineChart
              embedded
              name={`Evolução de ${exercise.name}`}
              points={exercise.points.map((point) => ({
                date: point.localDate,
                value: point.value,
              }))}
              tableName={`Dados de evolução de ${exercise.name}`}
              unit={metricUnit(exercise.metric)}
            />
          </div>
        ))}
      </section>

      <section className="card analytics-summary">
        <h2>Dor registrada</h2>
        <p className="field-hint">
          Frequencia por tipo, intensidade e regiao, atribuida a data civil informada no relato.
        </p>
        {analytics.pain.length === 0 ? (
          <p>Dados insuficientes: nenhum relato de dor no período.</p>
        ) : (
          <table aria-label="Frequência de dor por tipo, intensidade e região">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Intensidade</th>
                <th scope="col">Região</th>
                <th scope="col">Relatos</th>
              </tr>
            </thead>
            <tbody>
              {analytics.pain.map((pain) => (
                <tr key={`${pain.type}:${pain.intensity}:${pain.bodyRegion}`}>
                  <td>{pain.type === 'joint' ? 'Articular' : 'Muscular'}</td>
                  <td>{intensityLabel(pain.intensity)}</td>
                  <td>{regionLabel(pain.bodyRegion)}</td>
                  <td>{pain.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function AccessibleLineChart({
  description,
  embedded = false,
  name,
  points,
  tableName,
  unit,
}: {
  description?: string;
  embedded?: boolean;
  name: string;
  points: Array<{ date: string; value: number }>;
  tableName: string;
  unit: string;
}) {
  const id = `chart-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const content = (
    <section aria-labelledby={id} role="group" className="accessible-chart">
      <h2 id={id}>{name}</h2>
      {description && <p className="field-hint">{description}</p>}
      {points.length === 0 ? (
        <p>Dados insuficientes para exibir este gráfico.</p>
      ) : (
        <>
          <div className="chart-visual" aria-hidden="true">
            <LineChart data={points} height={220} margin={{ left: 0, right: 24 }} width={560}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={dateLabel} />
              <YAxis />
              <Tooltip labelFormatter={(label) => dateLabel(String(label))} />
              <Line dataKey="value" dot type="monotone" stroke="#245b3c" strokeWidth={3} />
            </LineChart>
          </div>
          <table aria-label={tableName}>
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Valor</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={`${point.date}:${index}`}>
                  <td>{dateLabel(point.date)}</td>
                  <td>
                    {numberLabel(point.value)} {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
  return embedded ? content : <div className="card analytics-chart-card">{content}</div>;
}

function metricUnit(metric: 'distance' | 'duration' | 'repetitions'): string {
  if (metric === 'distance') return 'metros';
  if (metric === 'duration') return 'segundos';
  return 'repetições';
}

function intensityLabel(intensity: string): string {
  return (
    { light: 'Leve', moderate: 'Moderada', not_informed: 'Não informada', strong: 'Forte' }[
      intensity
    ] ?? intensity
  );
}

function regionLabel(region: string): string {
  return (
    {
      ankle: 'Tornozelo',
      back: 'Costas',
      foot: 'Pé',
      knee: 'Joelho',
      shoulder: 'Ombro',
    }[region] ?? region
  );
}
