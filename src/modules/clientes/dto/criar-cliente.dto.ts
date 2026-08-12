import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { TIPO_CLIENTE, type TipoCliente } from '../../../common/domain/status.enums';
import { PADRAO_IDENTIFICADOR } from '../../../common/dto/patterns';

export class CriarClienteDto {
  @ApiPropertyOptional({
    description: 'Identificador do cliente. Gerado automaticamente se omitido.',
    example: 'svc_faturamento',
  })
  @IsOptional()
  @Matches(PADRAO_IDENTIFICADOR)
  clientId?: string;

  @ApiProperty({ example: 'Serviço de Faturamento', minLength: 3, maxLength: 150 })
  @IsString()
  @Length(3, 150)
  nome!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @ApiPropertyOptional({
    enum: Object.values(TIPO_CLIENTE),
    default: TIPO_CLIENTE.SERVICO,
    description: '`servico` para microsserviços; `rpa` para a aplicação compartilhada das RPAs.',
  })
  @IsOptional()
  @IsIn(Object.values(TIPO_CLIENTE))
  tipo: TipoCliente = TIPO_CLIENTE.SERVICO;
}
