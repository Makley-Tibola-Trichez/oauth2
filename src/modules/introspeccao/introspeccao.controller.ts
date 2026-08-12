import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { resolverCredenciaisCliente } from '../../common/dto/resolver-credenciais-cliente';
import { ClientesService } from '../clientes';
import { IntrospeccaoFormDto } from './dto/introspeccao-form.dto';
import { IntrospeccaoRespostaDto } from './dto/introspeccao-resposta.dto';
import { IntrospeccaoService } from './introspeccao.service';

@ApiTags('Tokens')
@Controller('oauth')
export class IntrospeccaoController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly introspeccaoService: IntrospeccaoService,
  ) {}

  @Post('introspect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consulta centralizada da situação de um token',
    description:
      'Mecanismo **opcional**: a validação normal deve ser feita localmente pelos ' +
      'microsserviços, com a chave pública do JWKS. Este endpoint acrescenta o que o JWT ' +
      'sozinho não mostra — se o cliente ou a RPA foram revogados após a emissão.\n\n' +
      'Exige credenciais de um cliente ativo. Token inválido, expirado ou de titular ' +
      'bloqueado devolve `active: false` com HTTP 200, como manda a RFC 7662.',
  })
  async introspectar(
    @Body() formulario: IntrospeccaoFormDto,
    @Req() request: Request,
  ): Promise<IntrospeccaoRespostaDto> {
    const { clientId, clientSecret } = resolverCredenciaisCliente(
      request.headers.authorization,
      formulario.client_id,
      formulario.client_secret,
    );
    const solicitante = await this.clientesService.autenticarCliente(clientId, clientSecret);
    return this.introspeccaoService.introspectar(formulario.token, solicitante.clientId);
  }
}
