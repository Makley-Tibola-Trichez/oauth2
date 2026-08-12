import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { LoggingModule, RequestContextMiddleware } from './common/logging';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [AppConfigModule, LoggingModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
