import { Module } from '@nestjs/common';
import { TokenAuthGuard } from '../../common/guards/token-auth.guard';
import { ChavesJwtModule } from '../chaves-jwt';
import { TokenService } from './token.service';

@Module({
  imports: [ChavesJwtModule],
  providers: [TokenService, TokenAuthGuard],
  exports: [TokenService, TokenAuthGuard],
})
export class TokenServiceModule {}
