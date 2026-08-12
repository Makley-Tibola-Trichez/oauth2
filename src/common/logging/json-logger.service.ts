import type { LoggerService } from '@nestjs/common';
import { redigirCampos } from './redaction';
import { obterRequestId } from './request-context';

export type NivelLog = 'debug' | 'info' | 'warn' | 'error';

const PESO_NIVEL: Record<NivelLog, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Logger que emite uma linha JSON por evento em stdout, pronta para coleta
 * pelo Grafana Loki. Implementa `LoggerService` do Nest (para substituir o
 * logger padrão do framework) e expõe {@link JsonLoggerService.evento} para
 * os eventos de auditoria estruturados.
 */
export class JsonLoggerService implements LoggerService {
  constructor(private readonly nivelMinimo: NivelLog = 'info') {}

  log(mensagem: unknown, contexto?: string): void {
    this.escrever('info', mensagem, contexto);
  }

  error(mensagem: unknown, trace?: string, contexto?: string): void {
    this.escrever('error', mensagem, contexto, trace ? { stack: trace } : undefined);
  }

  warn(mensagem: unknown, contexto?: string): void {
    this.escrever('warn', mensagem, contexto);
  }

  debug(mensagem: unknown, contexto?: string): void {
    this.escrever('debug', mensagem, contexto);
  }

  verbose(mensagem: unknown, contexto?: string): void {
    this.escrever('debug', mensagem, contexto);
  }

  /** Evento de auditoria estruturado: nível, nome do evento e campos livres. */
  evento(
    nivel: NivelLog,
    evento: string,
    mensagem: string,
    campos: Record<string, unknown> = {},
  ): void {
    this.escrever(nivel, mensagem, undefined, { evento, ...campos });
  }

  private escrever(
    nivel: NivelLog,
    mensagem: unknown,
    contexto?: string,
    camposExtras?: Record<string, unknown>,
  ): void {
    if (PESO_NIVEL[nivel] < PESO_NIVEL[this.nivelMinimo]) {
      return;
    }

    const linha: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      nivel: nivel.toUpperCase(),
      logger: contexto ?? 'app',
      mensagem: typeof mensagem === 'string' ? mensagem : JSON.stringify(mensagem),
    };

    const requestId = obterRequestId();
    if (requestId) {
      linha.requestId = requestId;
    }

    if (camposExtras) {
      Object.assign(linha, redigirCampos(camposExtras));
    }

    process.stdout.write(`${JSON.stringify(linha)}\n`);
  }
}
