/** Erros da integração com o Vault. */

export class VaultError extends Error {}

/** O cofre não respondeu ou respondeu com erro de infraestrutura. */
export class VaultIndisponivelError extends VaultError {}

/** O token da aplicação não tem permissão sobre o caminho solicitado. */
export class VaultPermissaoError extends VaultError {}
