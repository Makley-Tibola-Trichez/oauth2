import { ApiProperty } from '@nestjs/swagger';

export type StatusComponente = 'ok' | 'indisponivel';

export class SaudeRespostaDto {
  @ApiProperty({
    enum: ['ok', 'degradado'],
    description: 'Situação geral do serviço',
  })
  status!: 'ok' | 'degradado';

  @ApiProperty()
  aplicacao!: string;

  @ApiProperty()
  versao!: string;

  @ApiProperty()
  ambiente!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string', enum: ['ok', 'indisponivel'] },
    description: 'Situação de cada dependência externa (banco de dados, Vault)',
  })
  componentes!: Record<string, StatusComponente>;
}
