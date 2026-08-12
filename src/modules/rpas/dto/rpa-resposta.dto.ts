import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { STATUS_ACESSO } from '../../../common/domain/status.enums';

export class RpaRespostaDto {
  @ApiProperty() rpaId!: string;
  @ApiProperty() nome!: string;
  @ApiPropertyOptional({ nullable: true }) descricao!: string | null;
  @ApiProperty({ enum: Object.values(STATUS_ACESSO) }) status!: string;
  @ApiProperty() criadoEm!: Date;
  @ApiProperty() atualizadoEm!: Date;
  @ApiPropertyOptional({ nullable: true }) revogadoEm!: Date | null;
}

export class CredenciaisRpaRespostaDto {
  @ApiProperty() rpaId!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  credenciais!: Record<string, unknown>;
}
