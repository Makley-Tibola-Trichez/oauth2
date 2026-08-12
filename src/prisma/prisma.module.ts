import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Sem repository pattern (decisão do projeto): os services de cada módulo
 * injetam o `PrismaService` diretamente — padrão idiomático do NestJS.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
