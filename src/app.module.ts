import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AllExceptionsFilter, InfraExceptionFilter } from './common/filters';
import { LoggingModule, RequestContextMiddleware } from './common/logging';
import { AppConfigModule } from './config/app-config.module';
import { AdminAuthModule } from './modules/admin-auth';
import { ChavesJwtModule } from './modules/chaves-jwt';
import { ClientesModule } from './modules/clientes';
import { HashingModule } from './modules/hashing';
import { HealthModule } from './modules/health/health.module';
import { IntrospeccaoModule } from './modules/introspeccao';
import { JwksModule } from './modules/jwks';
import { OauthRpaModule } from './modules/oauth-rpa';
import { OauthServiceModule } from './modules/oauth-service';
import { RpasModule } from './modules/rpas';
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
    ClientesModule,
    RpasModule,
    OauthRpaModule,
    OauthServiceModule,
    IntrospeccaoModule,
    JwksModule,
    HealthModule,
  ],
  controllers: [],
  providers: [InfraExceptionFilter, AllExceptionsFilter],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
