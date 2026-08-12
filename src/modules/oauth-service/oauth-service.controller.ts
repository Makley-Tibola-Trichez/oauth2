import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { resolverCredenciaisCliente } from '../../common/dto/resolver-credenciais-cliente';
import { ErroOAuthRespostaDto, TokenRespostaDto } from '../../common/dto/token-resposta.dto';
import { CredenciaisClienteFormDto } from './dto/credenciais-cliente-form.dto';
import { OauthServiceService } from './oauth-service.service';

@ApiTags('Tokens')
@Controller('oauth')
export class OauthServiceController {
  constructor(private readonly oauthServiceService: OauthServiceService) {}

  @Post('service/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Emite um access token para um microsserviço',
    description:
      'OAuth2 Client Credentials. As credenciais podem vir no corpo do formulário ou no ' +
      'cabeçalho `Authorization: Basic`.',
  })
  @ApiResponse({ status: 401, type: ErroOAuthRespostaDto, description: 'Credenciais inválidas' })
  @ApiResponse({ status: 403, type: ErroOAuthRespostaDto, description: 'Cliente bloqueado' })
  async emitirToken(
    @Body() formulario: CredenciaisClienteFormDto,
    @Req() request: Request,
  ): Promise<TokenRespostaDto> {
    const { clientId, clientSecret } = resolverCredenciaisCliente(
      request.headers.authorization,
      formulario.client_id,
      formulario.client_secret,
    );
    const token = await this.oauthServiceService.emitirToken(clientId, clientSecret);
    return {
      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn,
    };
  }
}
