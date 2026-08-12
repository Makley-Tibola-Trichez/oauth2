import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { LoggingModule, RequestContextMiddleware } from './common/logging';
import { AppConfigModule } from './config/app-config.module';
import { ChavesJwtModule } from './modules/chaves-jwt';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { VaultModule } from './vault';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    VaultModule,
    ChavesJwtModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
