import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { resolverCredenciaisCliente } from '../../common/dto/resolver-credenciais-cliente';
import { ErroOAuthRespostaDto, TokenRespostaDto } from '../../common/dto/token-resposta.dto';
import { CredenciaisRpaFormDto } from './dto/credenciais-rpa-form.dto';
import { OauthRpaService } from './oauth-rpa.service';

@ApiTags('Tokens')
@Controller('oauth')
export class OauthRpaController {
  constructor(private readonly oauthRpaService: OauthRpaService) {}

  @Post('rpa/token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Emite um access token para uma RPA',
    description:
      'OAuth2 Client Credentials com o parâmetro adicional `rpaId`.\n\n' +
      'A validação acontece nesta ordem: `client_id` + `client_secret` contra o PostgreSQL, ' +
      'depois a autorização do `rpaId` no Vault e o status da RPA no cadastro. O `rpaId` ' +
      'recebido só vira claim depois de confirmado.',
  })
  @ApiResponse({ status: 400, type: ErroOAuthRespostaDto, description: 'rpa_id não autorizado' })
  @ApiResponse({ status: 401, type: ErroOAuthRespostaDto, description: 'Credenciais inválidas' })
  @ApiResponse({ status: 403, type: ErroOAuthRespostaDto, description: 'Cliente ou RPA bloqueado' })
  async emitirToken(
    @Body() formulario: CredenciaisRpaFormDto,
    @Req() request: Request,
  ): Promise<TokenRespostaDto> {
    const { clientId, clientSecret } = resolverCredenciaisCliente(
      request.headers.authorization,
      formulario.client_id,
      formulario.client_secret,
    );
    const token = await this.oauthRpaService.emitirToken(clientId, clientSecret, formulario.rpaId);
    return {
      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn,
    };
  }
}
