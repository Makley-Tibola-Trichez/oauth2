import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SaudeRespostaDto } from './dto/saude-resposta.dto';
import { HealthService } from './health.service';

@ApiTags('Infraestrutura')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Verifica a saúde do serviço' })
  @ApiOkResponse({ type: SaudeRespostaDto })
  async health(): Promise<SaudeRespostaDto> {
    return this.healthService.verificar();
  }
}
