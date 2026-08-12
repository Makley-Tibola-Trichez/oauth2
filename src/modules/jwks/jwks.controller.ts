import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { KeyManagerService } from '../chaves-jwt';
import type { JwksRespostaDto } from './dto/jwks-resposta.dto';

const SEGUNDOS_DE_CACHE = 300;

@ApiTags('Infraestrutura')
@Controller()
export class JwksController {
  constructor(private readonly keyManager: KeyManagerService) {}

  @Get('.well-known/jwks.json')
  @Header('Cache-Control', `public, max-age=${SEGUNDOS_DE_CACHE}`)
  @ApiOperation({
    summary: 'Chaves públicas (JWKS)',
    description:
      'Permite que os microsserviços validem os tokens localmente, sem chamar este ' +
      'serviço a cada requisição. Servido a partir do PostgreSQL — não depende do Vault.',
  })
  async jwks(): Promise<JwksRespostaDto> {
    return this.keyManager.obterJwks();
  }
}
