import { Module } from '@nestjs/common';
import { ChavesJwtModule } from '../chaves-jwt';
import { TokenService } from './token.service';

@Module({
  imports: [ChavesJwtModule],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenServiceModule {}
