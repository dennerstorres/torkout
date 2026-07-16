import { syncStateMessage } from '../presentation';
import {
  Button,
  EmptyState,
  Field,
  FormGroup,
  MetricCard,
  Panel,
  Section,
  StatusBadge,
  Surface,
} from './ui';

export function DesignSystemLab() {
  return (
    <main className="design-system-lab">
      <header className="page-header">
        <div>
          <p className="eyebrow">Fase 15 · laboratório</p>
          <h1>Sistema visual</h1>
          <p>Estados e níveis de superfície usados para revisar o produto sem dados reais.</p>
        </div>
      </header>

      <Section eyebrow="Hierarquia" title="Superfícies">
        <div className="lab-grid">
          <Surface density="compact">Compacta</Surface>
          <Surface>Standard</Surface>
          <Surface density="spacious" variant="raised">
            Elevada
          </Surface>
          <Surface variant="highlighted">Destacada</Surface>
        </div>
      </Section>

      <Section eyebrow="Controles" title="Ações e campos">
        <div className="button-row">
          <Button variant="primary">Ação principal</Button>
          <Button>Ação secundária</Button>
          <Button variant="ghost">Ação discreta</Button>
          <Button variant="danger">Ação destrutiva</Button>
          <Button disabled>Carregando…</Button>
        </div>
        <FormGroup legend="Estados de entrada">
          <Field label="Campo padrão" placeholder="Digite um valor" />
          <Field disabled label="Campo indisponível" value="Valor preservado" readOnly />
          <Field aria-invalid="true" label="Campo com erro" value="Revisar informação" readOnly />
        </FormGroup>
      </Section>

      <Section eyebrow="Dados" title="Métricas e apoio">
        <div className="metric-grid">
          <MetricCard label="Sessões concluídas" value="12" />
          <MetricCard label="Distância caminhada" value="18,4 km" />
          <MetricCard label="Frequência semanal" value="4 dias" />
        </div>
        <Panel title="Contexto da decisão">
          <p>Painéis apoiam uma tarefa principal sem competir com o conteúdo.</p>
        </Panel>
      </Section>

      <Section eyebrow="Feedback" title="Salvar e sincronizar">
        <div className="lab-state-grid">
          {(['synced', 'pending', 'offline', 'error', 'conflict'] as const).map((state) => (
            <Surface density="compact" key={state}>
              <StatusBadge
                tone={
                  state === 'synced'
                    ? 'success'
                    : state === 'error' || state === 'conflict'
                      ? 'danger'
                      : 'warning'
                }
              >
                {state === 'synced'
                  ? 'Sincronizado'
                  : state === 'pending'
                    ? 'Salvo neste dispositivo'
                    : state === 'offline'
                      ? 'Offline'
                      : state === 'error'
                        ? 'Falha temporária'
                        : 'Decisão necessária'}
              </StatusBadge>
              <p>{syncStateMessage(state)}</p>
            </Surface>
          ))}
        </div>
      </Section>

      <Section eyebrow="Estado" title="Sem conteúdo">
        <EmptyState
          title="Nada por aqui"
          action={<Button variant="primary">Criar registro</Button>}
        >
          Registre a primeira informação para acompanhar sua evolução.
        </EmptyState>
      </Section>
    </main>
  );
}
