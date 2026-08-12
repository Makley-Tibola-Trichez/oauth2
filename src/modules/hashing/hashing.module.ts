import { Module } from '@nestjs/common';
import { HashingService } from './hashing.service';
import { SecretGeneratorService } from './secret-generator.service';

@Module({
  providers: [HashingService, SecretGeneratorService],
  exports: [HashingService, SecretGeneratorService],
})
export class HashingModule {}
