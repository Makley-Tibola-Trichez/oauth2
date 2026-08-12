import { Module } from '@nestjs/common';
import { KeyManagerService } from './key-manager.service';

@Module({
  providers: [KeyManagerService],
  exports: [KeyManagerService],
})
export class ChavesJwtModule {}
