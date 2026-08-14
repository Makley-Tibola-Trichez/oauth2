import { config } from '../../config/env';
import { prisma } from '../../prisma/client';
import { logger } from '../../shared/logging';
import { type VaultClient, vaultClient } from '../../vault';
import { APP_VERSION } from '../../version';
import type { SaudeResposta } from './health.schemas';

interface Banco {
  $queryRaw: typeof prisma.$queryRaw;
}

async function verificarBancoDeDados(db: Banco): Promise<'ok' | 'indisponivel'> {
  try {
    await db.$queryRaw`SELECT 1`;
    return 'ok';
  } catch (erro) {
    logger.warn('Banco de dados indisponível', 'health', {
      motivo: erro instanceof Error ? erro.message : String(erro),
    });
    return 'indisponivel';
  }
}

async function verificarVault(vault: VaultClient): Promise<'ok' | 'indisponivel'> {
  try {
    return (await vault.verificarSaude()) ? 'ok' : 'indisponivel';
  } catch (erro) {
    logger.warn('Vault indisponível', 'health', {
      motivo: erro instanceof Error ? erro.message : String(erro),
    });
    return 'indisponivel';
  }
}

/**
 * `db`/`vault` recebem os singletons por padrão — nos testes, passe fakes
 * explicitamente em vez de mockar os módulos.
 */
export async function verificarSaude(
  db: Banco = prisma,
  vault: VaultClient = vaultClient,
): Promise<SaudeResposta> {
  const [bancoDeDados, vaultStatus] = await Promise.all([
    verificarBancoDeDados(db),
    verificarVault(vault),
  ]);
  const componentes: SaudeResposta['componentes'] = { bancoDeDados, vault: vaultStatus };

  return {
    status: Object.values(componentes).every((v) => v === 'ok') ? 'ok' : 'degradado',
    aplicacao: config.appName,
    versao: APP_VERSION,
    ambiente: config.nodeEnv,
    componentes,
  };
}
