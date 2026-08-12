import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChaveDeAssinaturaIndisponivelError } from '../../modules/chaves-jwt';
import { VaultError } from '../../vault';
import { JSON_LOGGER } from '../logging';
import type { JsonLoggerService } from '../logging/json-logger.service';

/**
 * Falhas de infraestrutura (Vault fora do ar, sem chave de assinatura) viram
 * `503`: o cliente não fez nada errado, o serviço é que está indisponível.
 */
@Injectable()
@Catch(ChaveDeAssinaturaIndisponivelError, VaultError)
export class InfraExceptionFilter implements ExceptionFilter {
  constructor(@Inject(JSON_LOGGER) private readonly logger: JsonLoggerService) {}

  catch(excecao: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    this.logger.error(excecao.message, excecao.stack, 'InfraExceptionFilter');
    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      detail:
        excecao instanceof VaultError
          ? 'Cofre de segredos indisponível'
          : 'Serviço de assinatura indisponível',
    });
  }
}
