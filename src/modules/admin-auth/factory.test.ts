import { describe, expect, it } from 'bun:test';
import type { AppConfig } from '../../config/env';
import { AutenticadorEntraId } from './entra-id';
import { criarAutenticadorAdmin } from './factory';
import { AutenticadorTokenEstatico } from './static-token';

function configParcial(overrides: Partial<AppConfig>): AppConfig {
  return { adminAuthMode: 'static', ...overrides } as AppConfig;
}

describe('criarAutenticadorAdmin', () => {
  it('escolhe a implementação estática por padrão', () => {
    const autenticador = criarAutenticadorAdmin(
      configParcial({ adminAuthMode: 'static', adminToken: 'token-de-teste' }),
    );

    expect(autenticador).toBeInstanceOf(AutenticadorTokenEstatico);
  });

  it('escolhe o Entra ID quando configurado', () => {
    const autenticador = criarAutenticadorAdmin(
      configParcial({
        adminAuthMode: 'entraid',
        entraTenantId: 'tenant-123',
        entraClientId: 'client-456',
      }),
    );

    expect(autenticador).toBeInstanceOf(AutenticadorEntraId);
    expect((autenticador as AutenticadorEntraId).tenantId).toBe('tenant-123');
  });
});
