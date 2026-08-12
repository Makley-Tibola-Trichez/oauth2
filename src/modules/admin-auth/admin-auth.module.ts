import { Module } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { AppConfigService } from '../../config/app-config.service';
import { criarAutenticadorAdmin } from './admin-auth.factory';
import { IAutenticadorAdmin } from './autenticador.interface';

@Module({
  providers: [
    {
      provide: IAutenticadorAdmin,
      useFactory: criarAutenticadorAdmin,
      inject: [AppConfigService],
    },
    AdminAuthGuard,
  ],
  exports: [IAutenticadorAdmin, AdminAuthGuard],
})
export class AdminAuthModule {}
