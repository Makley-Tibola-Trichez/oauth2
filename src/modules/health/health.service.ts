import { config } from '../../config/env';
import { APP_VERSION } from '../../version';
import type { SaudeResposta } from './health.schemas';

/**
 * Checagem de saúde do serviço. Por enquanto só reporta dados da aplicação;
 * ganha checagens de Postgres e Vault quando esses módulos existirem.
 */
export async function verificarSaude(): Promise<SaudeResposta> {
  const componentes: SaudeResposta['componentes'] = {};

  return {
    status: Object.values(componentes).every((v) => v === 'ok') ? 'ok' : 'degradado',
    aplicacao: config.appName,
    versao: APP_VERSION,
    ambiente: config.nodeEnv,
    componentes,
  };
}
