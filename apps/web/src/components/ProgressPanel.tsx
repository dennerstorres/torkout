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

function TrendRow({ label, trend, unit }: { label: string; trend: Trend; unit: string }) {
  return (
    <div className="trend-row">
      <dt>{label}</dt>
      <dd>
        {trend === null ? (
          'Sem medições no período.'
        ) : (
          <>
            {numberLabel(trend.first.value)} {unit} em {trend.first.localDate} →{' '}
            {numberLabel(trend.last.value)} {unit} em {trend.last.localDate} (
            {trend.delta >= 0 ? '+' : ''}
            {numberLabel(trend.delta)} {unit})
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

function RepetitionTable({
  caption,
  points,
}: {
  caption: string;
  points: ProgressPanelResponse['pushUpsPerSession'];
}) {
  if (points.length === 0) return <p>Nenhum registro de {caption.toLocaleLowerCase('pt-BR')}.</p>;
  return (
    <table aria-label={caption}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Data</th>
          <th scope="col">Repetições</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.localDate}>
            <td>{point.localDate}</td>
            <td>{numberLabel(point.repetitions)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ProgressPanel({ panel }: ProgressPanelProps) {
  const levels = panel.levels;
  return (
    <div className="progress-panel">
      <section className="card" aria-label="Indicadores de progressão">
        <h2>Indicadores de progressão</h2>
        <p className="field-hint">
          Estes indicadores resumem o que você registrou e não substituem avaliação profissional.
        </p>
        <div className="today-summary">
          <MetricCard label="Treinos concluídos" value={panel.concludedSessions} />
          <MetricCard label="Sequência atual" value={panel.currentStreak} />
          <MetricCard label="Melhor sequência" value={panel.longestStreak} />
          <MetricCard label="Treinos na semana" value={panel.sessionsThisWeek} />
        </div>
      </section>

      <section className="card" aria-label="Aderência">
        <h2>Aderência</h2>
        <p className="field-hint">{panel.adherence.explanation}</p>
        <p className="field-hint">
          Período efetivamente avaliado: {panel.adherence.evaluatedFrom} a{' '}
          {panel.adherence.evaluatedThrough}.
        </p>
        <div className="adherence-grid">
          <AdherenceCard breakdown={panel.adherence.strength} title="Aderência de força" />
          <AdherenceCard breakdown={panel.adherence.walk} title="Aderência de caminhada" />
          <AdherenceCard breakdown={panel.adherence.general} title="Aderência geral" />
        </div>
      </section>

      <section className="card" aria-label="Volume por treino">
        <h2>Volume por treino</h2>
        <RepetitionTable caption="Flexões por treino" points={panel.pushUpsPerSession} />
        <RepetitionTable caption="Agachamentos por treino" points={panel.squatsPerSession} />
        <p>
          <strong>Maior número de repetições em uma série: </strong>
          {panel.bestSet === null ? (
            'não registrado'
          ) : (
            <span>
              {panel.bestSet.repetitions} repetições em {panel.bestSet.exercise} (
              {panel.bestSet.localDate})
            </span>
          )}
        </p>
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
          {levels.current.achievedAt ? ` · alcançado em ${levels.current.achievedAt}` : ''}
        </p>
        <ProgressBar
          label={`Progresso até ${levels.next?.name ?? 'o nível máximo'}`}
          value={levels.progressToNext}
        />
        {levels.next && (
          <div className="level-criteria">
            <div>
              <h3 id="level-achieved">Critérios atingidos</h3>
              <ul aria-labelledby="level-achieved">
                {levels.next.criteria.filter((criterion) => criterion.achieved).length === 0 && (
                  <li>Nenhum critério atingido ainda.</li>
                )}
                {levels.next.criteria
                  .filter((criterion) => criterion.achieved)
                  .map((criterion) => (
                    <li key={criterion.key}>
                      {criterion.label} {criterion.value}/{criterion.target}
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <h3 id="level-remaining">Critérios restantes</h3>
              <ul aria-labelledby="level-remaining">
                {levels.next.criteria.filter((criterion) => !criterion.achieved).length === 0 && (
                  <li>Nenhum critério restante.</li>
                )}
                {levels.next.criteria
                  .filter((criterion) => !criterion.achieved)
                  .map((criterion) => (
                    <li key={criterion.key}>
                      {criterion.label} {criterion.value}/{criterion.target}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}
        {levels.levels.length > 0 && (
          <table aria-label="Histórico de níveis">
            <thead>
              <tr>
                <th scope="col">Nível</th>
                <th scope="col">Alcançado em</th>
              </tr>
            </thead>
            <tbody>
              {levels.levels.map((level) => (
                <tr key={level.id}>
                  <td>{level.name}</td>
                  <td>{level.achievedAt ?? 'ainda não alcançado'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
