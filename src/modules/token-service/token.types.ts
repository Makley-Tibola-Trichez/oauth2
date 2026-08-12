export const TIPO_TOKEN_BEARER = 'Bearer';

export const TIPO_TOKEN = {
  RPA: 'rpa',
  SERVICE: 'service',
} as const;

/** Valor do claim `tipo`, que separa os dois públicos do serviço. */
export type TipoToken = (typeof TIPO_TOKEN)[keyof typeof TIPO_TOKEN];

export interface TokenEmitido {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  jti: string;
  expiraEm: Date;
  kid: string;
}

export interface ClaimsToken {
  sub: string;
  tipo: TipoToken;
  iss: string;
  aud: string;
  iat: Date;
  exp: Date;
  jti: string;
  rpaId?: string;
}
