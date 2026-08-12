import { HttpStatus } from '@nestjs/common';

/** Falha nos endpoints administrativos, respondida como `{"detail": ...}`. */
export class ErroDeNegocio extends Error {
  readonly statusCode: number = HttpStatus.BAD_REQUEST;

  constructor(detalhe: string) {
    super(detalhe);
  }
}

export class RecursoNaoEncontradoError extends ErroDeNegocio {
  override readonly statusCode = HttpStatus.NOT_FOUND;
}

export class RecursoDuplicadoError extends ErroDeNegocio {
  override readonly statusCode = HttpStatus.CONFLICT;
}

export class OperacaoNaoPermitidaError extends ErroDeNegocio {
  override readonly statusCode = HttpStatus.FORBIDDEN;
}
