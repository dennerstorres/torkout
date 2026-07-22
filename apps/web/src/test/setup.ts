import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// A réplica local roda sobre fake-indexeddb; com os arquivos de teste em paralelo, abrir o banco
// pode passar do padrão de 1 s e reprovar uma consulta correta. O limite maior mantém a assertiva
// intacta e remove a instabilidade observada no `pnpm test`.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});
