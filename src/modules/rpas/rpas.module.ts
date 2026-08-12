import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth';
import { TokenServiceModule } from '../token-service';
import { RpasController } from './rpas.controller';
import { RpasService } from './rpas.service';

@Module({
  imports: [AdminAuthModule, TokenServiceModule],
  controllers: [RpasController],
  providers: [RpasService],
  exports: [RpasService],
})
export class RpasModule {}
