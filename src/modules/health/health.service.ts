import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { APP_VERSION } from '../../version';
import type { SaudeRespostaDto, StatusComponente } from './dto/saude-resposta.dto';

@Injectable()
export class HealthService {
  constructor(private readonly config: AppConfigService) {}

  async verificar(): Promise<SaudeRespostaDto> {
    const componentes: Record<string, StatusComponente> = {};

    return {
      status: Object.values(componentes).every((v) => v === 'ok') ? 'ok' : 'degradado',
      aplicacao: this.config.appName,
      versao: APP_VERSION,
      ambiente: this.config.nodeEnv,
      componentes,
    };
  }
}
