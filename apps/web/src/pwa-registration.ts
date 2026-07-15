export type ServiceWorkerUpdate = {
  activate(): void;
};

export type RegisterServiceWorker = (onUpdate: (update: ServiceWorkerUpdate) => void) => () => void;

export const registerTorkoutServiceWorker: RegisterServiceWorker = (onUpdate) => {
  if (!('serviceWorker' in navigator)) return () => undefined;

  let allowReload = false;
  let disposed = false;
  let registration: ServiceWorkerRegistration | undefined;

  const controllerChanged = () => {
    if (allowReload) window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);

  const announceWaitingWorker = (candidate: ServiceWorkerRegistration) => {
    if (!candidate.waiting || disposed) return;
    onUpdate({
      activate() {
        allowReload = true;
        candidate.waiting?.postMessage({ type: 'SKIP_WAITING' });
      },
    });
  };

  const updateFound = () => {
    const worker = registration?.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller && registration) {
        announceWaitingWorker(registration);
      }
    });
  };

  void navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((nextRegistration) => {
      if (disposed) return;
      registration = nextRegistration;
      announceWaitingWorker(nextRegistration);
      nextRegistration.addEventListener('updatefound', updateFound);
      void nextRegistration.update();
    })
    .catch(() => {
      // The application remains usable online when service-worker registration is unavailable.
    });

  return () => {
    disposed = true;
    navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    registration?.removeEventListener('updatefound', updateFound);
  };
};
