/**
 * Roda antes de qualquer arquivo de teste (ver `bunfig.toml`). Define as
 * variáveis de ambiente obrigatórias antes que `src/config/env.ts` seja
 * importado pela primeira vez em qualquer teste.
 */

export const TOKEN_ADMIN_DE_TESTE = 'token-admin-de-teste';
export const ISSUER_DE_TESTE = 'https://auth.testes';
export const AUDIENCE_DE_TESTE = 'microservicos-de-teste';
export const URL_BANCO_DE_TESTE =
  process.env.TEST_DATABASE_URL ?? 'postgresql://oauth:oauth@localhost:5432/oauth_test';

Object.assign(process.env, {
  APP_NAME: 'OAuth2 Auth Service',
  NODE_ENV: 'test',
  LOG_LEVEL: 'warn',
  DATABASE_URL: URL_BANCO_DE_TESTE,
  TEST_DATABASE_URL: URL_BANCO_DE_TESTE,
  VAULT_ADDR: process.env.VAULT_ADDR ?? 'http://localhost:8200',
  VAULT_TOKEN: process.env.VAULT_TOKEN ?? 'dev-root-token',
  JWT_ISSUER: ISSUER_DE_TESTE,
  JWT_AUDIENCE: AUDIENCE_DE_TESTE,
  ACCESS_TOKEN_EXPIRE_MINUTES: '30',
  KEY_ROTATION_GRACE_MINUTES: '35',
  ADMIN_AUTH_MODE: 'static',
  ADMIN_TOKEN: TOKEN_ADMIN_DE_TESTE,
});
