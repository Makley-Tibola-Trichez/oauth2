/**
 * Implementação **temporária**, apenas para desenvolvimento e testes.
 *
 * Compara a credencial com o `ADMIN_TOKEN` do ambiente em tempo constante.
 * Não há identidade real: todos os administradores compartilham o mesmo
 * token.
 */

import { timingSafeEqual } from 'node:crypto';
import { CredencialAdminInvalidaError } from '../../shared/errors';
import { type AutenticadorAdmin, type IdentidadeAdmin, ORIGEM_ESTATICA } from './admin-auth.types';

export class AutenticadorTokenEstatico implements AutenticadorAdmin {
  readonly origem = ORIGEM_ESTATICA;

  constructor(
    private readonly tokenEsperado: string,
    private readonly identificador = 'administrador-local',
  ) {
    if (!tokenEsperado) {
      throw new Error('Token administrativo não configurado');
    }
  }

  async autenticar(credencial: string | undefined | null): Promise<IdentidadeAdmin> {
    if (!credencial || !comparacaoEmTempoConstante(credencial, this.tokenEsperado)) {
      throw new CredencialAdminInvalidaError();
    }
    return { identificador: this.identificador, origem: this.origem };
  }
}

function comparacaoEmTempoConstante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  // Buffers de tamanhos diferentes vazariam o comprimento por timing; usa um
  // buffer do mesmo tamanho do esperado como alvo de comparação nesse caso,
  // garantindo que o resultado seja sempre "diferente" sem early-return.
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferB, bufferB);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
