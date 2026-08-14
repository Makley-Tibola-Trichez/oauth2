/**
 * Configuração da aplicação, carregada de variáveis de ambiente.
 *
 * O Bun lê `.env` automaticamente (não precisa de `dotenv`). A validação
 * roda uma vez, na primeira importação deste módulo — falha cedo em vez de
 * deixar um serviço mal configurado aceitar requisições.
 */

export type NodeEnv = 'development' | 'test' | 'production';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ModoAutenticacaoAdmin = 'static' | 'entraid';

export interface AppConfig {
  appName: string;
  nodeEnv: NodeEnv;
  port: number;
  logLevel: LogLevel;

  databaseUrl: string;
  testDatabaseUrl?: string;

  /**
   * Endereço/token do Vault dev usado pelo docker-compose. A implementação
   * concreta do cliente é fornecida à parte — ver `src/vault/client.ts`.
   */
  vaultAddr: string;
  vaultToken: string;
  vaultKvMount: string;
  vaultBasePath: string;

  jwtIssuer: string;
  jwtAudience: string;
  accessTokenExpireMinutes: number;
  keyRotationGraceMinutes: number;

  adminAuthMode: ModoAutenticacaoAdmin;
  adminToken?: string;
  entraTenantId?: string;
  entraClientId?: string;
}

function obrigatorio(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  }
  return valor;
}

function numero(nome: string, padrao: number): number {
  const valor = process.env[nome];
  if (!valor) {
    return padrao;
  }
  const n = Number(valor);
  if (!Number.isFinite(n)) {
    throw new Error(`Variável de ambiente ${nome} precisa ser numérica`);
  }
  return n;
}

function normalizarPrefixo(valor: string): string {
  return valor.replace(/^\/+|\/+$/g, '');
}

export function carregarConfig(): AppConfig {
  const adminAuthMode = (process.env.ADMIN_AUTH_MODE ?? 'static') as ModoAutenticacaoAdmin;

  if (adminAuthMode === 'static' && !process.env.ADMIN_TOKEN) {
    throw new Error('ADMIN_TOKEN é obrigatório quando ADMIN_AUTH_MODE=static');
  }
  if (
    adminAuthMode === 'entraid' &&
    !(process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID)
  ) {
    throw new Error(
      'ENTRA_TENANT_ID e ENTRA_CLIENT_ID são obrigatórios quando ADMIN_AUTH_MODE=entraid',
    );
  }

  return {
    appName: process.env.APP_NAME ?? 'OAuth2 Auth Service',
    nodeEnv: (process.env.NODE_ENV as NodeEnv) ?? 'development',
    port: numero('PORT', 3000),
    logLevel: (process.env.LOG_LEVEL as LogLevel) ?? 'info',

    databaseUrl: obrigatorio('DATABASE_URL'),
    testDatabaseUrl: process.env.TEST_DATABASE_URL,

    vaultAddr: obrigatorio('VAULT_ADDR'),
    vaultToken: obrigatorio('VAULT_TOKEN'),
    vaultKvMount: process.env.VAULT_KV_MOUNT ?? 'secret',
    vaultBasePath: normalizarPrefixo(process.env.VAULT_BASE_PATH ?? 'oauth'),

    jwtIssuer: obrigatorio('JWT_ISSUER'),
    jwtAudience: obrigatorio('JWT_AUDIENCE'),
    accessTokenExpireMinutes: numero('ACCESS_TOKEN_EXPIRE_MINUTES', 30),
    keyRotationGraceMinutes: numero('KEY_ROTATION_GRACE_MINUTES', 35),

    adminAuthMode,
    adminToken: process.env.ADMIN_TOKEN,
    entraTenantId: process.env.ENTRA_TENANT_ID,
    entraClientId: process.env.ENTRA_CLIENT_ID,
  };
}

/** Instância única, calculada na primeira importação. */
export const config: AppConfig = carregarConfig();
