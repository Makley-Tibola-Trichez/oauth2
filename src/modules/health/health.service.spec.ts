import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { VaultService } from '../../vault';
import { HealthService } from './health.service';

function criarServico(sobrescritas?: { bancoOk?: boolean; vaultOk?: boolean }) {
  const config = mock<AppConfigService>({ appName: 'OAuth2 Auth Service', nodeEnv: 'test' });

  const prisma = mock<PrismaService>();
  if (sobrescritas?.bancoOk === false) {
    prisma.$queryRaw.mockRejectedValue(new Error('conexão recusada'));
  } else {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  }

  const vault = mock<VaultService>();
  vault.verificarSaude.mockResolvedValue(sobrescritas?.vaultOk !== false);

  return new HealthService(config, prisma, vault);
}

describe('HealthService', () => {
  it('retorna ok quando todas as dependências respondem', async () => {
    const resposta = await criarServico().verificar();

    expect(resposta.status).toBe('ok');
    expect(resposta.componentes).toEqual({ bancoDeDados: 'ok', vault: 'ok' });
    expect(resposta.aplicacao).toBe('OAuth2 Auth Service');
    expect(resposta.versao).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('retorna degradado quando o banco de dados falha', async () => {
    const resposta = await criarServico({ bancoOk: false }).verificar();

    expect(resposta.status).toBe('degradado');
    expect(resposta.componentes.bancoDeDados).toBe('indisponivel');
    expect(resposta.componentes.vault).toBe('ok');
  });

  it('retorna degradado quando o Vault falha', async () => {
    const resposta = await criarServico({ vaultOk: false }).verificar();

    expect(resposta.status).toBe('degradado');
    expect(resposta.componentes.vault).toBe('indisponivel');
  });

  it('não deixa uma exceção do Vault derrubar o healthcheck', async () => {
    const config = mock<AppConfigService>({ appName: 'x', nodeEnv: 'test' });
    const prisma = mock<PrismaService>();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const vault = mock<VaultService>();
    vault.verificarSaude.mockRejectedValue(new Error('timeout'));

    const resposta = await new HealthService(config, prisma, vault).verificar();

    expect(resposta.componentes.vault).toBe('indisponivel');
  });
});
