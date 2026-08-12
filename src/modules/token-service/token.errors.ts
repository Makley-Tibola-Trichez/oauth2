/** Token ausente, malformado, com assinatura inválida ou claims faltando. */
export class TokenInvalidoError extends Error {}

/** Token bem formado, porém fora da validade. */
export class TokenExpiradoError extends TokenInvalidoError {}
