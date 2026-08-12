import type { AppConfigService } from '../../config/app-config.service';
import { type IAutenticadorAdmin, ORIGEM_ENTRA_ID } from './autenticador.interface';
import { AutenticadorEntraIdService } from './autenticador-entra-id.service';
import { AutenticadorTokenEstaticoService } from './autenticador-token-estatico.service';

/** Escolhe a implementação conforme `ADMIN_AUTH_MODE`. */
export function criarAutenticadorAdmin(config: AppConfigService): IAutenticadorAdmin {
  if (config.adminAuthMode === ORIGEM_ENTRA_ID) {
    return new AutenticadorEntraIdService(config.entraTenantId ?? '', config.entraClientId ?? '');
  }
  return new AutenticadorTokenEstaticoService(config.adminToken ?? '');
}
