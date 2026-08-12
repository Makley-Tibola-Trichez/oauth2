import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('retorna ok quando o banco de dados responde', async () => {
    const config = mock<AppConfigService>({
      appName: 'OAuth2 Auth Service',
      nodeEnv: 'test',
    });
    const prisma = mock<PrismaService>();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const resposta = await new HealthService(config, prisma).verificar();

    expect(resposta.aplicacao).toBe('OAuth2 Auth Service');
    expect(resposta.ambiente).toBe('test');
    expect(resposta.status).toBe('ok');
    expect(resposta.componentes.bancoDeDados).toBe('ok');
    expect(resposta.versao).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('retorna degradado quando o banco de dados falha', async () => {
    const config = mock<AppConfigService>({ appName: 'x', nodeEnv: 'test' });
    const prisma = mock<PrismaService>();
    prisma.$queryRaw.mockRejectedValue(new Error('conexão recusada'));

    const resposta = await new HealthService(config, prisma).verificar();

    expect(resposta.status).toBe('degradado');
    expect(resposta.componentes.bancoDeDados).toBe('indisponivel');
  });
});
