import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes';
import { TokenServiceModule } from '../token-service';
import { OauthServiceController } from './oauth-service.controller';
import { OauthServiceService } from './oauth-service.service';

@Module({
  imports: [ClientesModule, TokenServiceModule],
  controllers: [OauthServiceController],
  providers: [OauthServiceService],
})
export class OauthServiceModule {}
