import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './environment-variables';

/**
 * Fachada tipada sobre o `ConfigService` — equivalente ao `Settings`/`obter_settings()`
 * da versão em Python. Os módulos dependem desta classe, nunca de `process.env` direto.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  get appName(): string {
    return this.config.get('APP_NAME', { infer: true });
  }

  get nodeEnv(): EnvironmentVariables['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get logLevel(): EnvironmentVariables['LOG_LEVEL'] {
    return this.config.get('LOG_LEVEL', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get vaultAddr(): string {
    return this.config.get('VAULT_ADDR', { infer: true });
  }

  get vaultToken(): string {
    return this.config.get('VAULT_TOKEN', { infer: true });
  }

  get vaultKvMount(): string {
    return this.config.get('VAULT_KV_MOUNT', { infer: true });
  }

  /** Prefixo dos segredos da aplicação dentro do mount KV, sem barras nas pontas. */
  get vaultBasePath(): string {
    return this.config.get('VAULT_BASE_PATH', { infer: true }).replace(/^\/+|\/+$/g, '');
  }

  get jwtIssuer(): string {
    return this.config.get('JWT_ISSUER', { infer: true });
  }

  get jwtAudience(): string {
    return this.config.get('JWT_AUDIENCE', { infer: true });
  }

  get accessTokenExpireMinutes(): number {
    return this.config.get('ACCESS_TOKEN_EXPIRE_MINUTES', { infer: true });
  }

  get keyRotationGraceMinutes(): number {
    return this.config.get('KEY_ROTATION_GRACE_MINUTES', { infer: true });
  }

  get adminAuthMode(): EnvironmentVariables['ADMIN_AUTH_MODE'] {
    return this.config.get('ADMIN_AUTH_MODE', { infer: true });
  }

  get adminToken(): string | undefined {
    return this.config.get('ADMIN_TOKEN', { infer: true });
  }

  get entraTenantId(): string | undefined {
    return this.config.get('ENTRA_TENANT_ID', { infer: true });
  }

  get entraClientId(): string | undefined {
    return this.config.get('ENTRA_CLIENT_ID', { infer: true });
  }
}
