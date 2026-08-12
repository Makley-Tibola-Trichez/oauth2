import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { AppConfigService } from '../../config/app-config.service';
import { AuditLogService } from './audit-log.service';
import { JsonLoggerService } from './json-logger.service';
import { JSON_LOGGER } from './logging.constants';
import { RequestContextMiddleware } from './request-context.middleware';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    {
      provide: JSON_LOGGER,
      useFactory: (config: AppConfigService) => new JsonLoggerService(config.logLevel),
      inject: [AppConfigService],
    },
    AuditLogService,
    RequestContextMiddleware,
  ],
  exports: [JSON_LOGGER, AuditLogService, RequestContextMiddleware],
})
export class LoggingModule {}
