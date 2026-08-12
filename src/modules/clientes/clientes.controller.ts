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
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import type { IdentidadeAdmin } from '../admin-auth';
import {
  paraClienteCriadoResposta,
  paraClienteResposta,
  paraSecretRotacionadoResposta,
} from './clientes.mapper';
import { ClientesService } from './clientes.service';
import {
  ClienteCriadoRespostaDto,
  ClienteRespostaDto,
  SecretRotacionadoRespostaDto,
} from './dto/cliente-resposta.dto';
import { CriarClienteDto } from './dto/criar-cliente.dto';

@ApiTags('Administração de clientes')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('oauth/clients')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cria um novo cliente OAuth2',
    description: 'O `client_secret` é gerado aqui e devolvido **uma única vez**.',
  })
  async criar(
    @Body() dados: CriarClienteDto,
    @AdminIdentity() admin: IdentidadeAdmin,
  ): Promise<ClienteCriadoRespostaDto> {
    const { cliente, secret } = await this.clientesService.criar(dados, admin);
    return paraClienteCriadoResposta(cliente, secret);
  }

  @Get(':clientId')
  @ApiOperation({ summary: 'Consulta um cliente' })
  async obter(@Param('clientId') clientId: string): Promise<ClienteRespostaDto> {
    return paraClienteResposta(await this.clientesService.obter(clientId));
  }

  @Post(':clientId/rotate-secret')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotaciona o client_secret',
    description: 'Gera um novo secret e invalida o anterior imediatamente.',
  })
  async rotacionarSecret(
    @Param('clientId') clientId: string,
    @AdminIdentity() admin: IdentidadeAdmin,
  ): Promise<SecretRotacionadoRespostaDto> {
    const { cliente, secret } = await this.clientesService.rotacionarSecret(clientId, admin);
    return paraSecretRotacionadoResposta(cliente, secret);
  }

  @Post(':clientId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoga um cliente',
    description: 'Cliente revogado não obtém novos tokens; a operação é idempotente.',
  })
  async revogar(
    @Param('clientId') clientId: string,
    @AdminIdentity() admin: IdentidadeAdmin,
  ): Promise<ClienteRespostaDto> {
    return paraClienteResposta(await this.clientesService.revogar(clientId, admin));
  }
}
