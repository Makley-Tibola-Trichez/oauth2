import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('retorna os dados da aplicação a partir da configuração', async () => {
    const config = mock<AppConfigService>({
      appName: 'OAuth2 Auth Service',
      nodeEnv: 'test',
    });

    const resposta = await new HealthService(config).verificar();

    expect(resposta.aplicacao).toBe('OAuth2 Auth Service');
    expect(resposta.ambiente).toBe('test');
    expect(resposta.status).toBe('ok');
    expect(resposta.versao).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
