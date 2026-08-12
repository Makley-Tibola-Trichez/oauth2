import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfigService } from '../config/app-config.service';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Sessão do Prisma compartilhada pela aplicação.
 *
 * A partir do Prisma 7 a URL de conexão não vem mais do `schema.prisma`
 * (`datasource.url` foi removido) — o client precisa de um driver adapter
 * explícito. Aqui isso é montado a partir do `AppConfigService`, para que a
 * URL continue vindo de um só lugar na aplicação.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
