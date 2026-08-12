import { ApiProperty } from '@nestjs/swagger';

export class JwksRespostaDto {
  @ApiProperty({
    type: [Object],
    description:
      'Chaves públicas em uso. Inclui a chave ativa e as em rotação, para que tokens ' +
      'assinados antes de uma rotação continuem validáveis até expirarem.',
  })
  keys!: Record<string, unknown>[];
}
