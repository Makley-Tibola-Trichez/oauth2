import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class IntrospeccaoFormDto {
  @ApiProperty({ description: 'Access token a inspecionar' })
  @IsString()
  token!: string;

  @ApiPropertyOptional({ description: 'Pode vir aqui ou em Authorization: Basic' })
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  client_secret?: string;
}
