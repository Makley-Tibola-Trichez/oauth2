import { HttpStatus } from '@nestjs/common';

/**
 * Falha nos endpoints de token/introspection, no formato da RFC 6749.
 *
 * A resposta sai como `{"error": ..., "error_description": ...}`.
 */
export class ErroOAuth extends Error {
  readonly erro: string = 'invalid_request';
  readonly statusCode: number = HttpStatus.BAD_REQUEST;

  constructor(descricao: string) {
    super(descricao);
  }
}

/** `client_id`/`client_secret` não conferem. Mensagem propositalmente genérica. */
export class CredenciaisInvalidasError extends ErroOAuth {
  override readonly erro = 'invalid_client';
  override readonly statusCode = HttpStatus.UNAUTHORIZED;

  constructor(descricao = 'Credenciais de cliente inválidas') {
    super(descricao);
  }
}

/** Cliente ou RPA existe, mas está inativo ou revogado. */
export class AcessoBloqueadoError extends ErroOAuth {
  override readonly erro = 'invalid_client';
  override readonly statusCode = HttpStatus.FORBIDDEN;
}

/** O `rpaId` informado não está autorizado no Vault. */
export class RpaNaoAutorizadaError extends ErroOAuth {
  override readonly erro = 'invalid_request';
  override readonly statusCode = HttpStatus.BAD_REQUEST;
}
