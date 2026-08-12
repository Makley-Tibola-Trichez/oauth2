import { CredenciaisInvalidasError } from '../errors';

export interface CredenciaisBasic {
  username: string;
  password: string;
}

export function extrairCredenciaisBasic(cabecalho: string | undefined): CredenciaisBasic | null {
  if (!cabecalho?.startsWith('Basic ')) {
    return null;
  }
  const decodificado = Buffer.from(cabecalho.slice('Basic '.length), 'base64').toString('utf-8');
  const indice = decodificado.indexOf(':');
  if (indice === -1) {
    return null;
  }
  return { username: decodificado.slice(0, indice), password: decodificado.slice(indice + 1) };
}

/**
 * Extrai `client_id`/`client_secret` do cabeçalho `Authorization: Basic` ou
 * do formulário. A RFC 6749 prevê as duas formas; o cabeçalho tem
 * precedência quando presente.
 */
export function resolverCredenciaisCliente(
  cabecalhoAuthorization: string | undefined,
  clientIdFormulario: string | undefined,
  clientSecretFormulario: string | undefined,
): { clientId: string; clientSecret: string } {
  const basic = extrairCredenciaisBasic(cabecalhoAuthorization);
  if (basic) {
    return { clientId: basic.username, clientSecret: basic.password };
  }
  if (clientIdFormulario && clientSecretFormulario) {
    return { clientId: clientIdFormulario, clientSecret: clientSecretFormulario };
  }
  throw new CredenciaisInvalidasError('Credenciais de cliente não informadas');
}
