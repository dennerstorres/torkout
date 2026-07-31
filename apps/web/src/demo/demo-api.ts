import type { AppApi } from '../auth-client';
import { DEMO_USER_ID } from './demo-sync';

class DemoUnavailableError extends Error {
  constructor(operation: string) {
    super(`DEMO_UNAVAILABLE_${operation}`);
    this.name = 'DemoUnavailableError';
  }
}

function unavailable(operation: string): () => Promise<never> {
  return () => Promise.reject(new DemoUnavailableError(operation));
}

/**
 * API do modo demonstração. Nada aqui usa a rede.
 *
 * A sessão e o perfil respondem localmente, porque são o que decide qual tela abrir. Todo o resto
 * recusa: as telas já leem da réplica local e toleram hidratação indisponível, então a recusa
 * mantém a demonstração funcionando sem inventar um segundo caminho de leitura que envelheceria em
 * paralelo ao produto.
 *
 * Exportação, exclusão de conta e troca de senha não fazem sentido sem conta e por isso também
 * recusam, em vez de simular sucesso.
 */
export const demoApi: AppApi = {
  acceptPrivacy: unavailable('ACCEPT_PRIVACY'),
  decideProgression: unavailable('DECIDE_PROGRESSION'),
  deleteAccount: unavailable('DELETE_ACCOUNT'),
  deleteProgressPhoto: unavailable('DELETE_PHOTO'),
  exportData: unavailable('EXPORT'),
  async getProfile() {
    return { displayName: 'Visitante', timeZone: 'America/Cuiaba' };
  },
  async getSession() {
    return { user: { id: DEMO_USER_ID, name: 'Visitante' } };
  },
  listPrivacyDocuments: unavailable('PRIVACY_DOCUMENTS'),
  listProgressionSuggestions: unavailable('PROGRESSION_SUGGESTIONS'),
  listProgressPhotos: unavailable('LIST_PHOTOS'),
  listSessions: unavailable('LIST_SESSIONS'),
  loadDaily: unavailable('LOAD_DAILY'),
  loadHistoryPage: unavailable('LOAD_HISTORY'),
  loadProgressAnalytics: unavailable('LOAD_ANALYTICS'),
  loadProgressPanel: unavailable('LOAD_PROGRESS'),
  progressPhotoUrl: () => '',
  requestPasswordReset: unavailable('PASSWORD_RESET'),
  resetPassword: unavailable('RESET_PASSWORD'),
  revokeSession: unavailable('REVOKE_SESSION'),
  saveProfile: unavailable('SAVE_PROFILE'),
  signIn: unavailable('SIGN_IN'),
  async signOut() {
    // Sair da demonstração é tratado pelo próprio App, que apaga a réplica local.
  },
  signUp: unavailable('SIGN_UP'),
  uploadProgressPhoto: unavailable('UPLOAD_PHOTO'),
};
