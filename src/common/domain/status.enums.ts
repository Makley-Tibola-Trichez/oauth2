/**
 * Status persistidos como texto (não como enum nativo do Postgres) — evita
 * migrations de `ALTER TYPE`. A validação fica na camada de aplicação.
 */

export const STATUS_ACESSO = {
  ATIVO: 'ativo',
  INATIVO: 'inativo',
  REVOGADO: 'revogado',
} as const;

/** Situação de um cliente OAuth2 ou de uma RPA. */
export type StatusAcesso = (typeof STATUS_ACESSO)[keyof typeof STATUS_ACESSO];

export function statusPermiteEmitirToken(status: string): boolean {
  return status === STATUS_ACESSO.ATIVO;
}

export const TIPO_CLIENTE = {
  SERVICO: 'servico',
  RPA: 'rpa',
} as const;

/** Público ao qual o cliente OAuth2 pertence. */
export type TipoCliente = (typeof TIPO_CLIENTE)[keyof typeof TIPO_CLIENTE];

/**
 * Ciclo de vida de uma chave de assinatura JWT.
 *
 * - `ativa`: assina os tokens novos (existe no máximo uma — garantido por
 *   índice único parcial no banco).
 * - `em_rotacao`: não assina mais, mas continua publicada no JWKS até que os
 *   tokens emitidos com ela expirem.
 * - `aposentada`: fora do JWKS; a chave privada já foi removida do Vault.
 */
export const STATUS_CHAVE = {
  ATIVA: 'ativa',
  EM_ROTACAO: 'em_rotacao',
  APOSENTADA: 'aposentada',
} as const;

export type StatusChave = (typeof STATUS_CHAVE)[keyof typeof STATUS_CHAVE];

export function statusChavePublicavelNoJwks(status: string): boolean {
  return status === STATUS_CHAVE.ATIVA || status === STATUS_CHAVE.EM_ROTACAO;
}
