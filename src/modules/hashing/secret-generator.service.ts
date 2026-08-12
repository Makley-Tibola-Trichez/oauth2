import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/** Geração criptograficamente segura de credenciais OAuth2. */

// 48 bytes de entropia -> 64 caracteres em base64url.
export const TAMANHO_SECRET_BYTES = 48;

@Injectable()
export class SecretGeneratorService {
  /** Novo `client_secret`. Só é exibido uma vez; o banco guarda o hash. */
  gerarClientSecret(tamanhoBytes: number = TAMANHO_SECRET_BYTES): string {
    return randomBytes(tamanhoBytes).toString('base64url');
  }

  /** `client_id` legível quando o administrador não informa um. */
  gerarClientId(prefixo = 'app'): string {
    return `${prefixo.replace(/^_+|_+$/g, '')}_${randomBytes(8).toString('hex')}`;
  }
}
