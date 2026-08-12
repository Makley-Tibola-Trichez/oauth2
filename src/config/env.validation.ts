import * as Joi from 'joi';

/**
 * Valida as variáveis de ambiente na subida da aplicação — falha cedo em vez
 * de deixar um serviço mal configurado aceitar requisições.
 *
 * A consistência entre `ADMIN_AUTH_MODE` e as variáveis que cada modo exige
 * é verificada aqui com `Joi.when`, no mesmo espírito do `model_validator`
 * usado na versão em Python.
 */
export const envValidationSchema = Joi.object({
  APP_NAME: Joi.string().default('OAuth2 Auth Service'),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),

  DATABASE_URL: Joi.string().uri().required(),
  TEST_DATABASE_URL: Joi.string().uri().optional(),

  VAULT_ADDR: Joi.string().uri().required(),
  VAULT_TOKEN: Joi.string().required(),
  VAULT_KV_MOUNT: Joi.string().default('secret'),
  VAULT_BASE_PATH: Joi.string().default('oauth'),

  JWT_ISSUER: Joi.string().required(),
  JWT_AUDIENCE: Joi.string().required(),
  ACCESS_TOKEN_EXPIRE_MINUTES: Joi.number().integer().positive().default(30),
  KEY_ROTATION_GRACE_MINUTES: Joi.number().integer().positive().default(35),

  ADMIN_AUTH_MODE: Joi.string().valid('static', 'entraid').default('static'),
  ADMIN_TOKEN: Joi.string().when('ADMIN_AUTH_MODE', {
    is: 'static',
    // biome-ignore lint/suspicious/noThenProperty: chave exigida pela API do Joi
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
  ENTRA_TENANT_ID: Joi.string().when('ADMIN_AUTH_MODE', {
    is: 'entraid',
    // biome-ignore lint/suspicious/noThenProperty: chave exigida pela API do Joi
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
  ENTRA_CLIENT_ID: Joi.string().when('ADMIN_AUTH_MODE', {
    is: 'entraid',
    // biome-ignore lint/suspicious/noThenProperty: chave exigida pela API do Joi
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
});
