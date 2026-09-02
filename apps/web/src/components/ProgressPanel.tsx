import type { ProgressPanelResponse } from '@torkout/contracts';

import { MetricCard, ProgressBar } from './ui';

interface ProgressPanelProps {
  panel: ProgressPanelResponse;
}

type Trend = ProgressPanelResponse['weight'];

function numberLabel(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(value);
}

function percentage(value: number | null): string {
  return value === null ? 'não registrado' : `${numberLabel(value)}%`;
}

function localDateLabel(localDate: string): string {
  const [year, month, day] = localDate.split('-');
  return year && month && day ? `${day}/${month}/${year}` : localDate;
}

function deltaLabel(delta: number, unit: string): string {
  return `${delta > 0 ? '+' : ''}${numberLabel(delta)} ${unit}`;
}

function TrendRow({ label, trend, unit }: { label: string; trend: Trend; unit: string }) {
  const direction = trend === null || trend.delta === 0 ? 'flat' : trend.delta > 0 ? 'up' : 'down';
  return (
    <div className="trend-row">
      <dt>{label}</dt>
      <dd>
        {trend === null ? (
          <span className="trend-row__empty">Sem medições no período.</span>
        ) : (
          <>
            <span className="trend-row__points">
              <span className="trend-point">
                <strong>
                  {numberLabel(trend.first.value)} {unit}
                </strong>
                <small>{localDateLabel(trend.first.localDate)}</small>
              </span>
              <span aria-hidden="true" className="trend-row__arrow">
                →
              </span>
              <span className="trend-point">
                <strong>
                  {numberLabel(trend.last.value)} {unit}
                </strong>
                <small>{localDateLabel(trend.last.localDate)}</small>
              </span>
            </span>
            <span className={`trend-badge trend-badge--${direction}`}>
              {deltaLabel(trend.delta, unit)}
            </span>
          </>
        )}
      </dd>
    </div>
  );
}

function AdherenceCard({
  breakdown,
  title,
}: {
  breakdown: ProgressPanelResponse['adherence']['strength'];
  title: string;
}) {
  return (
    <div className="adherence-card">
      <h3>{title}</h3>
      <p className="adherence-card__value">{percentage(breakdown.percentage)}</p>
      <dl className="indicator-grid">
        <div>
          <dt>Sessões vencidas</dt>
          <dd>{breakdown.due}</dd>
        </div>
        <div>
          <dt>Concluídas</dt>
          <dd>{breakdown.completed}</dd>
        </div>
        <div>
          <dt>Parciais</dt>
          <dd>{breakdown.partial}</dd>
        </div>
        <div>
          <dt>Perdidas</dt>
          <dd>{breakdown.missed}</dd>
        </div>
        <div>
          <dt>Canceladas</dt>
          <dd>{breakdown.cancelled}</dd>
        </div>
        <div>
          <dt>Futuras (fora do cálculo)</dt>
          <dd>{breakdown.future}</dd>
        </div>
      </dl>
    </div>
  );
}

function VolumeCard({
  caption,
  points,
}: {
  caption: string;
  points: ProgressPanelResponse['pushUpsPerSession'];
}) {
  const best = points.reduce((highest, point) => Math.max(highest, point.repetitions), 0);
  const total = points.reduce((sum, point) => sum + point.repetitions, 0);
  const average = points.length === 0 ? 0 : total / points.length;
  return (
    <article className="volume-card">
      <h3 className="volume-card__title">{caption}</h3>
      {points.length === 0 ? (
        <p className="volume-card__empty">
          Nenhum registro de {caption.toLocaleLowerCase('pt-BR')}.
        </p>
      ) : (
        <>
          <p className="volume-card__summary">
            {points.length} {points.length === 1 ? 'treino' : 'treinos'} · média{' '}
            {numberLabel(average, 1)} · melhor {numberLabel(best)}
          </p>
          <table aria-label={caption} className="volume-table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Repetições</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.localDate}>
                  <th scope="row">{localDateLabel(point.localDate)}</th>
                  <td>
                    <span className="volume-bar">
                      <span className="volume-bar__track">
                        <span
                          className="volume-bar__fill"
                          style={{
                            width: `${best === 0 ? 0 : Math.round((point.repetitions / best) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="volume-bar__value">{numberLabel(point.repetitions)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </article>
  );
}

export function ProgressPanel({ panel }: ProgressPanelProps) {
  const levels = panel.levels;
  const adherence = Math.min(100, Math.max(0, panel.adherence.general.percentage ?? 0));
  return (
    <div className="progress-panel">
      <section className="progress-overview" aria-label="Resumo visual do progresso">
        <header className="progress-overview__heading">
          <div>
            <p className="eyebrow">Visão geral</p>
            <h2>Seu progresso</h2>
          </div>
          <span>
            {localDateLabel(panel.range.from)} — {localDateLabel(panel.range.through)}
          </span>
        </header>
        <div className="progress-overview__body">
          <div
            aria-label="Aderência geral no período"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={adherence}
            className="progress-dial"
            role="meter"
          >
            <svg aria-hidden="true" viewBox="0 0 200 112">
              <path
                className="progress-dial__track"
                d="M20 100 A80 80 0 0 1 180 100"
                pathLength="100"
              />
              <path
                className="progress-dial__value"
                d="M20 100 A80 80 0 0 1 180 100"
                pathLength="100"
                style={{ strokeDasharray: `${adherence} 100` }}
              />
            </svg>
            <span className="progress-dial__copy">
              <strong>{percentage(panel.adherence.general.percentage)}</strong>
              <small>Aderência geral</small>
            </span>
          </div>
          <div
            aria-label="Indicadores de progressão"
            className="progress-overview__metrics"
            role="region"
          >
            <div className="today-summary">
              <MetricCard label="Treinos concluídos" value={panel.concludedSessions} />
              <MetricCard label="Sequência atual" value={panel.currentStreak} />
              <MetricCard label="Melhor sequência" value={panel.longestStreak} />
              <MetricCard label="Treinos na semana" value={panel.sessionsThisWeek} />
            </div>
          </div>
        </div>
        <p className="field-hint">
          Estes indicadores resumem o que você registrou e não substituem avaliação profissional.
        </p>
      </section>

      <section className="card" aria-label="Aderência">
        <h2>Aderência</h2>
        <p className="field-hint">{panel.adherence.explanation}</p>
        <p className="field-hint">
          Período efetivamente avaliado: {localDateLabel(panel.adherence.evaluatedFrom)} a{' '}
          {localDateLabel(panel.adherence.evaluatedThrough)}.
        </p>
        <div className="adherence-grid">
          <AdherenceCard breakdown={panel.adherence.strength} title="Aderência de força" />
          <AdherenceCard breakdown={panel.adherence.walk} title="Aderência de caminhada" />
          <AdherenceCard breakdown={panel.adherence.general} title="Aderência geral" />
        </div>
      </section>

      <section className="card" aria-label="Volume por treino">
        <h2>Volume por treino</h2>
        <div className="volume-grid">
          <VolumeCard caption="Flexões por treino" points={panel.pushUpsPerSession} />
          <VolumeCard caption="Agachamentos por treino" points={panel.squatsPerSession} />
        </div>
        <div aria-label="Maior número de repetições em uma série" className="best-set" role="group">
          <span className="best-set__label">Maior número de repetições em uma série</span>
          {panel.bestSet === null ? (
            <strong className="best-set__value">Não registrado</strong>
          ) : (
            <>
              <strong className="best-set__value">{panel.bestSet.repetitions} repetições</strong>
              <span className="best-set__context">
                {panel.bestSet.exercise} · {localDateLabel(panel.bestSet.localDate)}
              </span>
            </>
          )}
        </div>
      </section>

      <section className="card" aria-label="Medidas corporais">
        <h2>Medidas corporais</h2>
        <dl className="trend-list">
          <TrendRow label="Peso" trend={panel.weight} unit="kg" />
          <TrendRow label="Cintura" trend={panel.waist} unit="cm" />
          <TrendRow label="Barriga" trend={panel.abdomen} unit="cm" />
        </dl>
        <p className="field-hint">
          Cintura e barriga são medidas distintas. Pequenas oscilações entre medições não são
          tratadas como ganho ou perda real.
        </p>
      </section>

      <section className="card" aria-label="Caminhadas">
        <h2>Caminhadas</h2>
        <div className="today-summary">
          <MetricCard label="Caminhadas concluídas" value={panel.walksConcluded} />
          <MetricCard
            label="Distância total"
            value={`${numberLabel(panel.walkDistanceMeters / 1000)} km`}
          />
          <MetricCard
            label="Tempo total"
            value={`${numberLabel(panel.walkDurationSeconds / 60, 0)} min`}
          />
        </div>
        <p className="field-hint">
          As caminhadas são contadas separadamente e não entram na aderência de força.
        </p>
      </section>

      <section className="card" aria-label="Esforço e recuperação">
        <h2>Esforço e recuperação</h2>
        <dl className="indicator-grid">
          <div>
            <dt>Média de esforço percebido</dt>
            <dd>
              {panel.averagePerceivedExertion === null
                ? 'não registrado'
                : numberLabel(panel.averagePerceivedExertion)}
            </dd>
          </div>
          <div>
            <dt>Registros de esforço</dt>
            <dd>{panel.perceivedExertionSamples}</dd>
          </div>
          <div>
            <dt>Treinos com resposta “sem dor”</dt>
            <dd>{panel.sessionsWithoutPain}</dd>
          </div>
          <div>
            <dt>Registros de dor muscular</dt>
            <dd>{panel.muscularPainReports}</dd>
          </div>
          <div>
            <dt>Registros de dor articular</dt>
            <dd>{panel.jointPainReports}</dd>
          </div>
          <div>
            <dt>Outros desconfortos</dt>
            <dd>{panel.otherDiscomfortReports}</dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-label="Níveis">
        <h2>Níveis</h2>
        <p className="field-hint">
          Os níveis dependem de consistência e de registro. O sistema não premia treinar com dor,
          esforço máximo nem volume excessivo.
        </p>
        <p className="level-current">
          <strong>{levels.current.name}</strong>
          {levels.current.achievedAt
            ? ` · alcançado em ${localDateLabel(levels.current.achievedAt)}`
            : ''}
        </p>
        <ProgressBar
          label={`Progresso até ${levels.next?.name ?? 'o nível máximo'}`}
          value={levels.progressToNext}
        />
        {levels.next && (
          <div className="level-criteria">
            <div>
              <h3 id="level-achieved">Critérios atingidos</h3>
              <ul aria-labelledby="level-achieved" className="criteria-list">
                {levels.next.criteria.filter((criterion) => criterion.achieved).length === 0 && (
                  <li className="criteria-list__empty">Nenhum critério atingido ainda.</li>
                )}
                {levels.next.criteria
                  .filter((criterion) => criterion.achieved)
                  .map((criterion) => (
                    <li className="criteria-item criteria-item--achieved" key={criterion.key}>
                      <span aria-hidden="true" className="criteria-item__mark">
                        ✓
                      </span>
                      {criterion.label}{' '}
                      <span className="criteria-item__value">
                        {criterion.value}/{criterion.target}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h3 id="level-remaining">Critérios restantes</h3>
              <ul aria-labelledby="level-remaining" className="criteria-list">
                {levels.next.criteria.filter((criterion) => !criterion.achieved).length === 0 && (
                  <li className="criteria-list__empty">Nenhum critério restante.</li>
                )}
                {levels.next.criteria
                  .filter((criterion) => !criterion.achieved)
                  .map((criterion) => (
                    <li className="criteria-item" key={criterion.key}>
                      <span aria-hidden="true" className="criteria-item__mark">
                        •
                      </span>
                      {criterion.label}{' '}
                      <span className="criteria-item__value">
                        {criterion.value}/{criterion.target}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}
        {levels.levels.length > 0 && (
          <table aria-label="Histórico de níveis" className="level-table">
            <thead>
              <tr>
                <th scope="col">Nível</th>
                <th scope="col">Alcançado em</th>
              </tr>
            </thead>
            <tbody>
              {levels.levels.map((level) => (
                <tr key={level.id}>
                  <th scope="row">{level.name}</th>
                  <td>
                    {level.achievedAt ? (
                      localDateLabel(level.achievedAt)
                    ) : (
                      <span className="level-table__pending">ainda não alcançado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
