import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Resposta da RFC 7662. Token inválido ou expirado devolve apenas `active: false`. */
export class IntrospeccaoRespostaDto {
  @ApiProperty()
  active!: boolean;

  @ApiPropertyOptional() sub?: string;
  @ApiPropertyOptional() tipo?: string;
  @ApiPropertyOptional() rpaId?: string;
  @ApiPropertyOptional() client_id?: string;
  @ApiPropertyOptional() iss?: string;
  @ApiPropertyOptional() aud?: string;
  @ApiPropertyOptional() iat?: number;
  @ApiPropertyOptional() exp?: number;
  @ApiPropertyOptional() jti?: string;
  @ApiPropertyOptional() token_type?: string;
}
