import {
  type IAutenticadorAdmin,
  type IdentidadeAdmin,
  ORIGEM_ENTRA_ID,
} from './autenticador.interface';

/**
 * Implementação definitiva com Microsoft Entra ID — ainda não habilitada.
 *
 * O contrato já está no lugar; o que falta é o miolo da validação:
 *
 * 1. baixar e cachear o JWKS do tenant em
 *    `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`;
 * 2. validar o JWT recebido (assinatura RS256, `iss` do tenant, `aud`
 *    igual ao `ENTRA_CLIENT_ID`, `exp`/`nbf`);
 * 3. exigir a role/app role administrativa nos claims (`roles` ou `scp`);
 * 4. devolver `IdentidadeAdmin` com `oid`/`appid` e `name`.
 *
 * Enquanto isso não for homologado contra um tenant real, a classe falha de
 * forma explícita em vez de aceitar credenciais sem verificação.
 */
export class AutenticadorEntraIdService implements IAutenticadorAdmin {
  readonly origem = ORIGEM_ENTRA_ID;

  constructor(
    readonly tenantId: string,
    readonly clientId: string,
  ) {}

  get urlJwks(): string {
    return `https://login.microsoftonline.com/${this.tenantId}/discovery/v2.0/keys`;
  }

  get issuerEsperado(): string {
    return `https://login.microsoftonline.com/${this.tenantId}/v2.0`;
  }

  async autenticar(_credencial: string | undefined | null): Promise<IdentidadeAdmin> {
    throw new Error(
      'Autenticação administrativa via Entra ID ainda não implementada; ' +
        'use ADMIN_AUTH_MODE=static até a homologação',
    );
  }
}
