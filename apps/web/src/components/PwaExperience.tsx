import { useEffect, useState } from 'react';

import {
  type RegisterServiceWorker,
  registerTorkoutServiceWorker,
  type ServiceWorkerUpdate,
} from '../pwa-registration';

export type { ServiceWorkerUpdate } from '../pwa-registration';

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

type PwaExperienceProps = {
  registerServiceWorker?: RegisterServiceWorker;
  version?: string;
};

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

export function PwaExperience({
  registerServiceWorker = registerTorkoutServiceWorker,
  version = import.meta.env.VITE_APP_VERSION ?? 'desenvolvimento',
}: PwaExperienceProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [update, setUpdate] = useState<ServiceWorkerUpdate | null>(null);

  useEffect(() => registerServiceWorker(setUpdate), [registerServiceWorker]);

  useEffect(() => {
    const available = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const completed = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', completed);
    return () => {
      window.removeEventListener('beforeinstallprompt', available);
      window.removeEventListener('appinstalled', completed);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <aside className="pwa-experience" aria-label="Instalação e versão do aplicativo">
      {update && (
        <section className="pwa-update" role="status">
          <strong>Atualização disponível</strong>
          <span>Seu formulário e suas alterações pendentes continuam abertos.</span>
          <button type="button" onClick={update.activate}>
            Atualizar quando estiver pronto
          </button>
        </section>
      )}
      <p className="pwa-version">
        <span>Versão {version}</span> ·{' '}
        {installed ? 'Aberto como aplicativo' : 'Aberto no navegador'}
      </p>
      <details className="pwa-installation">
        <summary>Como instalar</summary>
        {installPrompt && !installed && (
          <button className="primary" type="button" onClick={() => void install()}>
            Instalar neste dispositivo
          </button>
        )}
        <div className="installation-grid">
          <section>
            <h2>iPhone e iPad</h2>
            <p>No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p>
          </section>
          <section>
            <h2>Android</h2>
            <p>No Chrome, abra o menu e escolha “Instalar app” ou use o botão acima.</p>
          </section>
          <section>
            <h2>Computador</h2>
            <p>No Chrome ou Edge, use o ícone de instalação na barra de endereço.</p>
          </section>
        </div>
      </details>
    </aside>
  );
}
