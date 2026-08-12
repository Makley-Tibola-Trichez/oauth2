/**
 * Layout dos segredos da aplicação dentro do Vault.
 *
 * Centralizado aqui para que a convenção fique em um lugar só:
 *
 *     {mount}/{prefixo}/jwt/keys/{kid}   -> { chavePrivadaPem: "..." }
 *     {mount}/{prefixo}/rpa/{rpaId}      -> { credenciais: {...}, criadoEm: "..." }
 */

export function caminhoChavePrivada(kid: string): string {
  return `jwt/keys/${kid}`;
}

export function caminhoRpa(rpaId: string): string {
  return `rpa/${rpaId}`;
}
