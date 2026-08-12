import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hash do `client_secret`.
 *
 * O secret em texto puro só existe no instante em que é gerado e devolvido
 * ao administrador; o banco guarda exclusivamente o hash Argon2id.
 */
@Injectable()
export class HashingService {
  async gerarHash(secret: string): Promise<string> {
    return argon2.hash(secret);
  }

  /** Compara o secret com o hash. Retorna `false` em qualquer falha. */
  async verificar(secret: string, hashArmazenado: string): Promise<boolean> {
    try {
      return await argon2.verify(hashArmazenado, secret);
    } catch {
      return false;
    }
  }

  async precisaRehash(hashArmazenado: string): Promise<boolean> {
    try {
      return argon2.needsRehash(hashArmazenado);
    } catch {
      return false;
    }
  }
}
