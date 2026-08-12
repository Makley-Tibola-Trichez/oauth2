import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VaultService } from '../../vault';
import { APP_VERSION } from '../../version';
import type { SaudeRespostaDto, StatusComponente } from './dto/saude-resposta.dto';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
  ) {}

  async verificar(): Promise<SaudeRespostaDto> {
    const componentes: Record<string, StatusComponente> = {
      bancoDeDados: await this.verificarBancoDeDados(),
      vault: await this.verificarVault(),
    };

    return {
      status: Object.values(componentes).every((v) => v === 'ok') ? 'ok' : 'degradado',
      aplicacao: this.config.appName,
      versao: APP_VERSION,
      ambiente: this.config.nodeEnv,
      componentes,
    };
  }

  private async verificarBancoDeDados(): Promise<StatusComponente> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch (erro) {
      this.logger.warn(
        'Banco de dados indisponível',
        erro instanceof Error ? erro.stack : undefined,
      );
      return 'indisponivel';
    }
  }

  private async verificarVault(): Promise<StatusComponente> {
    try {
      return (await this.vault.verificarSaude()) ? 'ok' : 'indisponivel';
    } catch (erro) {
      this.logger.warn('Vault indisponível', erro instanceof Error ? erro.stack : undefined);
      return 'indisponivel';
    }
  }
}
