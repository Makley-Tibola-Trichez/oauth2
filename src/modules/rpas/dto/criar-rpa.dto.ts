import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PADRAO_IDENTIFICADOR } from '../../../common/dto/patterns';

export class CriarRpaDto {
  @ApiProperty({ pattern: PADRAO_IDENTIFICADOR.source, example: 'rpa_custeio' })
  @Matches(PADRAO_IDENTIFICADOR)
  rpaId!: string;

  @ApiProperty({ example: 'RPA de Custeio', minLength: 3, maxLength: 150 })
  @IsString()
  @Length(3, 150)
  nome!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @ApiPropertyOptional({
    description:
      'Credenciais que a RPA consome (usuário de sistema, chave de API...). São gravadas ' +
      'exclusivamente no Vault, nunca no banco.',
    example: { usuario: 'rpa.custeio', senha: '***' },
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  credenciais: Record<string, unknown> = {};
}
