import { config } from '../../config/env';
import { type AutenticadorAdmin, ORIGEM_ENTRA_ID } from './admin-auth.types';
import { AutenticadorEntraId } from './entra-id';
import { AutenticadorTokenEstatico } from './static-token';

/** Escolhe a implementação conforme `ADMIN_AUTH_MODE`. */
export function criarAutenticadorAdmin(cfg = config): AutenticadorAdmin {
  if (cfg.adminAuthMode === ORIGEM_ENTRA_ID) {
    return new AutenticadorEntraId(cfg.entraTenantId ?? '', cfg.entraClientId ?? '');
  }
  return new AutenticadorTokenEstatico(cfg.adminToken ?? '');
}

/** Instância compartilhada pela aplicação. */
export const autenticadorAdmin: AutenticadorAdmin = criarAutenticadorAdmin();
