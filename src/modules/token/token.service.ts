/**
 * Emissão e validação dos JWTs de acesso.
 *
 * Assinatura assimétrica (RS256): o serviço assina com a privada guardada
 * no Vault e os microsserviços validam localmente com a pública publicada
 * no JWKS. O `kid` no cabeçalho identifica a chave e viabiliza a rotação.
 */

import { randomUUID } from 'node:crypto';
import {
  decodeProtectedHeader,
  importPKCS8,
  importSPKI,
  type JWTPayload,
  errors as joseErrors,
  jwtVerify,
  SignJWT,
} from 'jose';
import { config } from '../../config/env';
import { TokenExpiradoError, TokenInvalidoError } from '../../shared/errors';
import { type KeyManagerService, keyManager } from '../chaves-jwt';
import {
  type ClaimsToken,
  TIPO_TOKEN,
  TIPO_TOKEN_BEARER,
  type TipoToken,
  type TokenEmitido,
} from './token.types';

// Claims que todo token emitido por este serviço precisa ter.
const CLAIMS_OBRIGATORIAS = ['sub', 'iss', 'aud', 'iat', 'exp', 'jti', 'tipo'];

export interface EmitirTokenParams {
  sub: string;
  tipo: TipoToken;
  rpaId?: string;
}

/**
 * `gerenciadorChaves`/`issuer`/`audience`/`expiracaoMinutos` recebem os
 * valores padrão da aplicação — nos testes, passe um `KeyManagerService`
 * fake em vez de mockar o módulo.
 */
export async function emitirToken(
  params: EmitirTokenParams,
  gerenciadorChaves: KeyManagerService = keyManager,
  issuer: string = config.jwtIssuer,
  audience: string = config.jwtAudience,
  expiracaoMinutos: number = config.accessTokenExpireMinutes,
): Promise<TokenEmitido> {
  const chave = await gerenciadorChaves.obterChaveDeAssinatura();
  const chavePrivada = await importPKCS8(chave.chavePrivadaPem, chave.algoritmo, {
    extractable: true,
  });

  const emitidoEm = new Date();
  emitidoEm.setMilliseconds(0);
  const expiraEm = new Date(emitidoEm.getTime() + expiracaoMinutos * 60_000);
  const jti = randomUUID();

  const payload: Record<string, unknown> = { tipo: params.tipo };
  if (params.rpaId !== undefined) {
    payload.rpaId = params.rpaId;
  }

  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: chave.algoritmo, kid: chave.kid, typ: 'JWT' })
    .setSubject(params.sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(Math.floor(emitidoEm.getTime() / 1000))
    .setExpirationTime(Math.floor(expiraEm.getTime() / 1000))
    .setJti(jti)
    .sign(chavePrivada);

  return {
    accessToken,
    tokenType: TIPO_TOKEN_BEARER,
    expiresIn: expiracaoMinutos * 60,
    jti,
    expiraEm,
    kid: chave.kid,
  };
}

/** Valida assinatura, `iss`/`aud` e validade, resolvendo a chave pelo `kid`. */
export async function validarToken(
  token: string,
  gerenciadorChaves: KeyManagerService = keyManager,
  issuer: string = config.jwtIssuer,
  audience: string = config.jwtAudience,
): Promise<ClaimsToken> {
  if (!token) {
    throw new TokenInvalidoError('Token não informado');
  }

  let kid: string | undefined;
  try {
    kid = decodeProtectedHeader(token).kid;
  } catch {
    throw new TokenInvalidoError('Cabeçalho do token inválido');
  }
  if (!kid) {
    throw new TokenInvalidoError('Token sem kid no cabeçalho');
  }

  const chave = await gerenciadorChaves.obterChavePublica(kid);
  if (!chave) {
    throw new TokenInvalidoError(`Chave ${kid} desconhecida ou aposentada`);
  }

  const chavePublica = await importSPKI(chave.chavePublicaPem, chave.algoritmo, {
    extractable: true,
  });

  try {
    const { payload } = await jwtVerify(token, chavePublica, {
      // Algoritmo do registro da chave, nunca o do cabeçalho do token:
      // aceitar o "alg" recebido abriria espaço para algorithm confusion.
      algorithms: [chave.algoritmo],
      issuer,
      audience,
      requiredClaims: CLAIMS_OBRIGATORIAS,
    });
    return paraClaimsToken(payload);
  } catch (erro) {
    if (erro instanceof joseErrors.JWTExpired) {
      throw new TokenExpiradoError('Token expirado');
    }
    if (erro instanceof TokenInvalidoError) {
      throw erro;
    }
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new TokenInvalidoError(`Token inválido: ${motivo}`);
  }
}

function paraClaimsToken(payload: JWTPayload): ClaimsToken {
  const { sub, iss, aud, iat, exp, jti, tipo, rpaId } = payload as JWTPayload & {
    tipo?: unknown;
    rpaId?: unknown;
  };

  if (
    typeof sub !== 'string' ||
    typeof iss !== 'string' ||
    typeof aud !== 'string' ||
    typeof iat !== 'number' ||
    typeof exp !== 'number' ||
    typeof jti !== 'string' ||
    (tipo !== TIPO_TOKEN.RPA && tipo !== TIPO_TOKEN.SERVICE)
  ) {
    throw new TokenInvalidoError('Claims do token em formato inesperado');
  }

  return {
    sub,
    tipo,
    iss,
    aud,
    iat: new Date(iat * 1000),
    exp: new Date(exp * 1000),
    jti,
    rpaId: typeof rpaId === 'string' ? rpaId : undefined,
  };
}
