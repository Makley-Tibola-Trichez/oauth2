import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { LoggingModule, RequestContextMiddleware } from './common/logging';
import { AppConfigModule } from './config/app-config.module';
import { AdminAuthModule } from './modules/admin-auth';
import { ChavesJwtModule } from './modules/chaves-jwt';
import { HashingModule } from './modules/hashing';
import { HealthModule } from './modules/health/health.module';
import { TokenServiceModule } from './modules/token-service';
import { PrismaModule } from './prisma/prisma.module';
import { VaultModule } from './vault';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    VaultModule,
    ChavesJwtModule,
    HashingModule,
    TokenServiceModule,
    AdminAuthModule,
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
