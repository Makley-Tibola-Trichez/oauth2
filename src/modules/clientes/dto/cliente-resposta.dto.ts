import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { STATUS_ACESSO, TIPO_CLIENTE } from '../../../common/domain/status.enums';

export class ClienteRespostaDto {
  @ApiProperty() clientId!: string;
  @ApiProperty() nome!: string;
  @ApiPropertyOptional({ nullable: true }) descricao!: string | null;
  @ApiProperty({ enum: Object.values(TIPO_CLIENTE) }) tipo!: string;
  @ApiProperty({ enum: Object.values(STATUS_ACESSO) }) status!: string;
  @ApiProperty() criadoEm!: Date;
  @ApiProperty() atualizadoEm!: Date;
  @ApiPropertyOptional({ nullable: true }) secretRotacionadoEm!: Date | null;
  @ApiPropertyOptional({ nullable: true }) revogadoEm!: Date | null;
}

export class ClienteCriadoRespostaDto extends ClienteRespostaDto {
  @ApiProperty({ description: 'Exibido uma única vez. O serviço armazena apenas o hash.' })
  clientSecret!: string;

  @ApiProperty({
    default: 'Guarde o client_secret agora: ele não poderá ser consultado novamente.',
  })
  aviso!: string;
}

export class SecretRotacionadoRespostaDto {
  @ApiProperty() clientId!: string;

  @ApiProperty({ description: 'Novo secret. O anterior deixa de valer imediatamente.' })
  clientSecret!: string;

  @ApiProperty() secretRotacionadoEm!: Date;

  @ApiProperty({
    default: 'Guarde o client_secret agora: ele não poderá ser consultado novamente.',
  })
  aviso!: string;
}
