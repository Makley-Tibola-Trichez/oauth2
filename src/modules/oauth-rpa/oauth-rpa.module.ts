import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes';
import { RpasModule } from '../rpas';
import { TokenServiceModule } from '../token-service';
import { OauthRpaController } from './oauth-rpa.controller';
import { OauthRpaService } from './oauth-rpa.service';

@Module({
  imports: [ClientesModule, RpasModule, TokenServiceModule],
  controllers: [OauthRpaController],
  providers: [OauthRpaService],
})
export class OauthRpaModule {}
