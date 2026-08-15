/**
 * Hash do `client_secret`.
 *
 * O secret em texto puro só existe no instante em que é gerado e devolvido
 * ao administrador; o banco guarda exclusivamente o hash Argon2id.
 */

import * as argon2 from 'argon2';

export async function gerarHash(secret: string): Promise<string> {
  return argon2.hash(secret);
}

/** Compara o secret com o hash. Retorna `false` em qualquer falha. */
export async function verificarHash(secret: string, hashArmazenado: string): Promise<boolean> {
  try {
    return await argon2.verify(hashArmazenado, secret);
  } catch {
    return false;
  }
}

export async function precisaRehash(hashArmazenado: string): Promise<boolean> {
  try {
    return argon2.needsRehash(hashArmazenado);
  } catch {
    return false;
  }
}
