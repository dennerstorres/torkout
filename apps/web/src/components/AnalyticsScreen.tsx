import type { ProgressAnalyticsResponse } from '@torkout/contracts';
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';

import type { UserSyncDatabase } from '../sync/local-database';

interface AnalyticsScreenProps {
  database: UserSyncDatabase;
  onBack(): void;
  onLoad?(from: string, through: string): Promise<ProgressAnalyticsResponse>;
  today?: string;
}

export function AnalyticsScreen(_props: AnalyticsScreenProps) {
  const { database, onBack, onLoad, today = new Date().toISOString().slice(0, 10) } = _props;
  const [preset, setPreset] = useState<'4' | '8' | '12' | 'custom'>('4');
  const [customFrom, setCustomFrom] = useState(today);
  const [customThrough, setCustomThrough] = useState(today);
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; through: string } | null>(
    null,
  );
  const [analytics, setAnalytics] = useState<ProgressAnalyticsResponse | null>(null);
  const [message, setMessage] = useState('Carregando indicadoresâ€¦');
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
              ? 'Exibindo a Ãºltima anÃ¡lise salva neste dispositivo.'
              : 'Nenhuma anÃ¡lise deste perÃ­odo estÃ¡ disponÃ­vel offline.',
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
        <p className="eyebrow">Indicadores pessoais</p>
        <h1>Progresso</h1>
        <p>
          Os indicadores resumem seus registros; eles nÃ£o substituem orientaÃ§Ã£o profissional.
        </p>
      </header>

      <section className="card analytics-filters" aria-labelledby="analytics-filter-title">
        <h2 id="analytics-filter-title">PerÃ­odo</h2>
        <div className="button-row" aria-label="PerÃ­odos rÃ¡pidos">
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
                setMessage('A data final nÃ£o pode anteceder a inicial.');
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
              Aplicar perÃ­odo
            </button>
          </form>
        )}
      </section>

      <p className="sync-note" role="status" aria-live="polite">
        {loading ? 'Carregando indicadoresâ€¦' : message}
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
        <h2>Resumo do perÃ­odo</h2>
        <p>
          {dateLabel(analytics.range.from)} a {dateLabel(analytics.range.through)} (datas
          inclusivas)
        </p>
        {noSessions && <p>Nenhum treino registrado no perÃ­odo.</p>}
        <dl className="indicator-grid">
          <div>
            <dt>Treinos concluÃ­dos</dt>
            <dd>{analytics.sessions.completed}</dd>
          </div>
          <div>
            <dt>Treinos parciais</dt>
            <dd>{analytics.sessions.partial}</dd>
          </div>
          <div>
            <dt>Caminhadas concluÃ­das ou parciais</dt>
            <dd>{analytics.walks.sessions}</dd>
          </div>
          <div>
            <dt>DistÃ¢ncia caminhada</dt>
            <dd>{numberLabel(analytics.walks.distanceMeters / 1000)} km</dd>
          </div>
          <div>
            <dt>FrequÃªncia de caminhada</dt>
            <dd>{numberLabel(analytics.walks.frequencyPerWeek)} por semana</dd>
          </div>
        </dl>
        <p className="field-hint">
          Caminhadas contam sessÃµes concluÃ­das ou parciais; a frequÃªncia Ã© o total dividido
          pelas semanas civis tocadas pelo perÃ­odo.
        </p>
      </section>

      <AccessibleLineChart
        name="EvoluÃ§Ã£o do peso"
        points={weight}
        tableName="Dados de evoluÃ§Ã£o do peso"
        unit="kg"
      />
      <AccessibleLineChart
        name="EvoluÃ§Ã£o da cintura"
        points={waist}
        tableName="Dados de evoluÃ§Ã£o da cintura"
        unit="cm"
      />
      <AccessibleLineChart
        description={analytics.consistency.explanation}
        name="ConsistÃªncia semanal"
        points={consistency}
        tableName="Dados de consistÃªncia semanal"
        unit="%"
      />
      <p className="analytics-formula-version">
        VersÃ£o da fÃ³rmula: <code>{analytics.consistency.formulaVersion}</code>
      </p>

      <section className="card analytics-summary">
        <h2>ExercÃ­cios</h2>
        {analytics.exercises.length === 0 && <p>Dados insuficientes para totais por exercÃ­cio.</p>}
        {analytics.exercises.map((exercise) => (
          <div className="exercise-analytics" key={`${exercise.exerciseId}:${exercise.metric}`}>
            <p>
              <strong>{exercise.name}:</strong> {numberLabel(exercise.total)}{' '}
              {metricUnit(exercise.metric)}
            </p>
            <AccessibleLineChart
              embedded
              name={`EvoluÃ§Ã£o de ${exercise.name}`}
              points={exercise.points.map((point) => ({
                date: point.localDate,
                value: point.value,
              }))}
              tableName={`Dados de evoluÃ§Ã£o de ${exercise.name}`}
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
          <p>Dados insuficientes: nenhum relato de dor no perÃ­odo.</p>
        ) : (
          <table aria-label="FrequÃªncia de dor por tipo, intensidade e regiÃ£o">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Intensidade</th>
                <th scope="col">RegiÃ£o</th>
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
        <p>Dados insuficientes para exibir este grÃ¡fico.</p>
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
  return 'repetiÃ§Ãµes';
}

function intensityLabel(intensity: string): string {
  return (
    { light: 'Leve', moderate: 'Moderada', not_informed: 'NÃ£o informada', strong: 'Forte' }[
      intensity
    ] ?? intensity
  );
}

function regionLabel(region: string): string {
  return (
    {
      ankle: 'Tornozelo',
      back: 'Costas',
      foot: 'PÃ©',
      knee: 'Joelho',
      shoulder: 'Ombro',
    }[region] ?? region
  );
}
