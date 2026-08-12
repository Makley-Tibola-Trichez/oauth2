import { Module } from '@nestjs/common';
import { ChavesJwtModule } from '../chaves-jwt';
import { JwksController } from './jwks.controller';

@Module({
  imports: [ChavesJwtModule],
  controllers: [JwksController],
})
export class JwksModule {}
