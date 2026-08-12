import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth';
import { HashingModule } from '../hashing';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

@Module({
  imports: [AdminAuthModule, HashingModule],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
