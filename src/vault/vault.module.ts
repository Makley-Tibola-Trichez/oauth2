import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { VaultService } from './vault.interfaces';
import { VaultHttpService } from './vault-http.service';

@Global()
@Module({
  imports: [HttpModule.register({ timeout: 5000 })],
  providers: [{ provide: VaultService, useClass: VaultHttpService }],
  exports: [VaultService],
})
export class VaultModule {}
