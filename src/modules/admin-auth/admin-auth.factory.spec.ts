import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import { criarAutenticadorAdmin } from './admin-auth.factory';
import { AutenticadorEntraIdService } from './autenticador-entra-id.service';
import { AutenticadorTokenEstaticoService } from './autenticador-token-estatico.service';

describe('criarAutenticadorAdmin', () => {
  it('escolhe a implementação estática por padrão', () => {
    const config = mock<AppConfigService>({
      adminAuthMode: 'static',
      adminToken: 'token-de-teste',
    });

    expect(criarAutenticadorAdmin(config)).toBeInstanceOf(AutenticadorTokenEstaticoService);
  });

  it('escolhe o Entra ID quando configurado', () => {
    const config = mock<AppConfigService>({
      adminAuthMode: 'entraid',
      entraTenantId: 'tenant-123',
      entraClientId: 'client-456',
    });

    const autenticador = criarAutenticadorAdmin(config);

    expect(autenticador).toBeInstanceOf(AutenticadorEntraIdService);
    expect((autenticador as AutenticadorEntraIdService).tenantId).toBe('tenant-123');
  });
});
