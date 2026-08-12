import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { GRANT_TYPE_SUPORTADO } from '../../../common/dto/token-resposta.dto';

export class CredenciaisClienteFormDto {
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
}
