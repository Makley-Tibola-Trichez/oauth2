import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PADRAO_IDENTIFICADOR } from '../../../common/dto/patterns';
import { GRANT_TYPE_SUPORTADO } from '../../../common/dto/token-resposta.dto';

export class CredenciaisRpaFormDto {
  @ApiProperty({ enum: [GRANT_TYPE_SUPORTADO], default: GRANT_TYPE_SUPORTADO })
  @IsIn([GRANT_TYPE_SUPORTADO])
  grant_type: string = GRANT_TYPE_SUPORTADO;

  @ApiPropertyOptional({ description: 'Pode vir aqui ou em Authorization: Basic' })
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_secret?: string;

  @ApiProperty({
    description:
      'RPA que está executando. Não é confiado por vir na requisição: o serviço confirma ' +
      'a autorização no Vault antes de emitir o token.',
    example: 'rpa_custeio',
  })
  @Matches(PADRAO_IDENTIFICADOR)
  rpaId!: string;
}
