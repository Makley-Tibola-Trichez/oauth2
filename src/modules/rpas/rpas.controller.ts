import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminIdentity } from '../../common/decorators/admin-identity.decorator';
import { ClaimsTokenParam } from '../../common/decorators/claims-token.decorator';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { TokenAuthGuard } from '../../common/guards/token-auth.guard';
import type { IdentidadeAdmin } from '../admin-auth';
import type { ClaimsToken } from '../token-service';
import { CriarRpaDto } from './dto/criar-rpa.dto';
import { CredenciaisRpaRespostaDto, RpaRespostaDto } from './dto/rpa-resposta.dto';
import { paraRpaResposta } from './rpas.mapper';
import { RpasService } from './rpas.service';

@ApiTags('Administração de RPAs')
@ApiBearerAuth()
@Controller('oauth/rpas')
export class RpasController {
  constructor(private readonly rpasService: RpasService) {}

  @Post()
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastra e autoriza uma RPA',
    description:
      'Grava o cadastro no PostgreSQL e as credenciais no Vault. A partir daí o `rpaId` ' +
      'passa a ser aceito em `POST /oauth/rpa/token`.',
  })
  async criar(
    @Body() dados: CriarRpaDto,
    @AdminIdentity() admin: IdentidadeAdmin,
  ): Promise<RpaRespostaDto> {
    return paraRpaResposta(await this.rpasService.criar(dados, admin));
  }

  @Get(':rpaId')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Consulta uma RPA' })
  async obter(@Param('rpaId') rpaId: string): Promise<RpaRespostaDto> {
    return paraRpaResposta(await this.rpasService.obter(rpaId));
  }

  @Post(':rpaId/revoke')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoga uma RPA',
    description: 'Marca a RPA como revogada e remove a autorização do Vault.',
  })
  async revogar(
    @Param('rpaId') rpaId: string,
    @AdminIdentity() admin: IdentidadeAdmin,
  ): Promise<RpaRespostaDto> {
    return paraRpaResposta(await this.rpasService.revogar(rpaId, admin));
  }

  @Get(':rpaId/credentials')
  @UseGuards(TokenAuthGuard)
  @ApiOperation({
    summary: 'Consulta as credenciais da própria RPA',
    description:
      'Autenticado com o access token da RPA (`tipo=rpa`). O `rpaId` do token precisa ser ' +
      'o mesmo da rota — uma RPA nunca lê credenciais de outra.',
  })
  async obterCredenciais(
    @Param('rpaId') rpaId: string,
    @ClaimsTokenParam() claims: ClaimsToken,
  ): Promise<CredenciaisRpaRespostaDto> {
    const credenciais = await this.rpasService.obterCredenciais(rpaId, claims);
    return { rpaId, credenciais };
  }
}
