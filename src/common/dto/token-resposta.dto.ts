import { ApiProperty } from '@nestjs/swagger';

export const GRANT_TYPE_SUPORTADO = 'client_credentials';

export class TokenRespostaDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty({ default: 'Bearer' })
  token_type = 'Bearer';

  @ApiProperty({ description: 'Validade do token em segundos' })
  expires_in!: number;
}

export class ErroOAuthRespostaDto {
  @ApiProperty({ example: 'invalid_client' })
  error!: string;

  @ApiProperty()
  error_description!: string;
}
