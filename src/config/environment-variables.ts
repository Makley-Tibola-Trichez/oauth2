/** Forma das variáveis de ambiente já validadas pelo {@link envValidationSchema}. */
export interface EnvironmentVariables {
  APP_NAME: string;
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';

  DATABASE_URL: string;
  TEST_DATABASE_URL?: string;

  VAULT_ADDR: string;
  VAULT_TOKEN: string;
  VAULT_KV_MOUNT: string;
  VAULT_BASE_PATH: string;

  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  ACCESS_TOKEN_EXPIRE_MINUTES: number;
  KEY_ROTATION_GRACE_MINUTES: number;

  ADMIN_AUTH_MODE: 'static' | 'entraid';
  ADMIN_TOKEN?: string;
  ENTRA_TENANT_ID?: string;
  ENTRA_CLIENT_ID?: string;
}
