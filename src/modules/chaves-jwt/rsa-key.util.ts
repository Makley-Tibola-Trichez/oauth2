/**
 * Geração de pares RSA e conversão de chave pública para JWK.
 *
 * Funções puras — sem Prisma e sem Vault — para facilitar os testes.
 */

import { generateKeyPairSync } from 'node:crypto';
import { calculateJwkThumbprint, exportJWK, importSPKI, type JWK } from 'jose';

export const ALGORITMO_PADRAO = 'RS256';
export const TAMANHO_CHAVE_PADRAO = 2048;

export interface ParDeChaves {
  kid: string;
  chavePrivadaPem: string;
  chavePublicaPem: string;
  algoritmo: string;
}

/** `kid` derivado da thumbprint RFC 7638 da chave pública. */
export async function calcularKid(chavePublicaPem: string): Promise<string> {
  const chave = await importSPKI(chavePublicaPem, ALGORITMO_PADRAO, { extractable: true });
  return calculateJwkThumbprint(await exportJWK(chave), 'sha256');
}

/** Monta a entrada de JWKS correspondente à chave pública. */
export async function chavePublicaParaJwk(
  chavePublicaPem: string,
  kid: string,
  algoritmo: string = ALGORITMO_PADRAO,
): Promise<JWK> {
  const chave = await importSPKI(chavePublicaPem, algoritmo, { extractable: true });
  const jwk = await exportJWK(chave);
  return { ...jwk, use: 'sig', alg: algoritmo, kid };
}

export async function gerarParDeChaves(
  tamanho: number = TAMANHO_CHAVE_PADRAO,
): Promise<ParDeChaves> {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: tamanho,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const kid = await calcularKid(publicKey);

  return {
    kid,
    chavePrivadaPem: privateKey,
    chavePublicaPem: publicKey,
    algoritmo: ALGORITMO_PADRAO,
  };
}
