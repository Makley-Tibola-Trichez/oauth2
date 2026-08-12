import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes';
import { RpasModule } from '../rpas';
import { TokenServiceModule } from '../token-service';
import { IntrospeccaoController } from './introspeccao.controller';
import { IntrospeccaoService } from './introspeccao.service';

@Module({
  imports: [ClientesModule, RpasModule, TokenServiceModule],
  controllers: [IntrospeccaoController],
  providers: [IntrospeccaoService],
})
export class IntrospeccaoModule {}
