/**
 * Erros de domínio. Traduzidos para respostas HTTP pelo `errorHandlerPlugin`
 * (`src/shared/error-handler.plugin.ts`), nunca pelos módulos individuais.
 */

/**
 * Falha nos endpoints de token/introspection, no formato da RFC 6749.
 * Vira `{"error": ..., "error_description": ...}`.
 */
export class ErroOAuth extends Error {
  readonly erro: string = 'invalid_request';
  readonly statusCode: number = 400;

  constructor(descricao: string) {
    super(descricao);
    this.name = 'ErroOAuth';
  }
}

/** `client_id`/`client_secret` não conferem. Mensagem propositalmente genérica. */
export class CredenciaisInvalidasError extends ErroOAuth {
  override readonly erro = 'invalid_client';
  override readonly statusCode = 401;

  constructor(descricao = 'Credenciais de cliente inválidas') {
    super(descricao);
    this.name = 'CredenciaisInvalidasError';
  }
}

/** Cliente ou RPA existe, mas está inativo ou revogado. */
export class AcessoBloqueadoError extends ErroOAuth {
  override readonly erro = 'invalid_client';
  override readonly statusCode = 403;

  constructor(descricao: string) {
    super(descricao);
    this.name = 'AcessoBloqueadoError';
  }
}

/** O `rpaId` informado não está autorizado no Vault. */
export class RpaNaoAutorizadaError extends ErroOAuth {
  override readonly erro = 'invalid_request';
  override readonly statusCode = 400;

  constructor(descricao: string) {
    super(descricao);
    this.name = 'RpaNaoAutorizadaError';
  }
}

/** Falha nos endpoints administrativos, respondida como `{"detail": ...}`. */
export class ErroDeNegocio extends Error {
  readonly statusCode: number = 400;

  constructor(detalhe: string) {
    super(detalhe);
    this.name = 'ErroDeNegocio';
  }
}

export class RecursoNaoEncontradoError extends ErroDeNegocio {
  override readonly statusCode = 404;
  constructor(detalhe: string) {
    super(detalhe);
    this.name = 'RecursoNaoEncontradoError';
  }
}

export class RecursoDuplicadoError extends ErroDeNegocio {
  override readonly statusCode = 409;
  constructor(detalhe: string) {
    super(detalhe);
    this.name = 'RecursoDuplicadoError';
  }
}

export class OperacaoNaoPermitidaError extends ErroDeNegocio {
  override readonly statusCode = 403;
  constructor(detalhe: string) {
    super(detalhe);
    this.name = 'OperacaoNaoPermitidaError';
  }
}

/** Credencial administrativa ausente, malformada ou não reconhecida. */
export class CredencialAdminInvalidaError extends Error {
  constructor(descricao = 'Credencial administrativa inválida') {
    super(descricao);
    this.name = 'CredencialAdminInvalidaError';
  }
}

/**
 * O autenticador administrativo configurado não conseguiu decidir (ex.: o
 * modo Entra ID ainda não homologado). Diferente de credencial inválida:
 * aqui o problema é do serviço, não de quem chamou.
 */
export class AutenticacaoAdminIndisponivelError extends Error {
  constructor(descricao = 'Autenticação administrativa indisponível') {
    super(descricao);
    this.name = 'AutenticacaoAdminIndisponivelError';
  }
}

/** Token ausente, malformado, com assinatura inválida ou claims faltando. */
export class TokenInvalidoError extends Error {
  constructor(descricao: string) {
    super(descricao);
    this.name = 'TokenInvalidoError';
  }
}

/** Token bem formado, porém fora da validade. */
export class TokenExpiradoError extends TokenInvalidoError {
  constructor(descricao = 'Token expirado') {
    super(descricao);
    this.name = 'TokenExpiradoError';
  }
}

/** Não há chave ativa no banco (ou a privada sumiu de onde o Vault a guarda). */
export class ChaveDeAssinaturaIndisponivelError extends Error {
  constructor(descricao: string) {
    super(descricao);
    this.name = 'ChaveDeAssinaturaIndisponivelError';
  }
}
