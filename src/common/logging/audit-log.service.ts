import { Inject, Injectable } from '@nestjs/common';
import type { JsonLoggerService } from './json-logger.service';
import { JSON_LOGGER, type NivelLog } from './logging.constants';

/** Nomes estáveis dos eventos de auditoria — permitem consultas no Loki. */
export const EVENTOS_AUDITORIA = {
  AUTENTICACAO_SUCESSO: 'autenticacao_sucesso',
  AUTENTICACAO_FALHA: 'autenticacao_falha',
  CLIENTE_CRIADO: 'cliente_criado',
  RPA_CRIADA: 'rpa_criada',
  SECRET_ROTACIONADO: 'secret_rotacionado',
  ACESSO_REVOGADO: 'acesso_revogado',
  CREDENCIAIS_ACESSADAS: 'credenciais_acessadas',
  OPERACAO_ADMIN: 'operacao_admin',
  INTROSPECCAO: 'introspeccao',
  CHAVE_ROTACIONADA: 'chave_rotacionada',
} as const;

export type EventoAuditoria = (typeof EVENTOS_AUDITORIA)[keyof typeof EVENTOS_AUDITORIA];

/**
 * Registro dos eventos de auditoria do serviço — autenticação, criação de
 * clientes/RPAs, rotação de secrets, revogação, acesso a credenciais e
 * operações administrativas. Nunca registra segredos: passa sempre pelo
 * filtro de redação do `JsonLoggerService`.
 */
@Injectable()
export class AuditLogService {
  constructor(@Inject(JSON_LOGGER) private readonly logger: JsonLoggerService) {}

  registrar(evento: EventoAuditoria, mensagem: string, campos: Record<string, unknown> = {}): void {
    this.logger.evento('info', evento, mensagem, campos);
  }

  registrarFalha(
    evento: EventoAuditoria,
    mensagem: string,
    campos: Record<string, unknown> = {},
  ): void {
    this.logger.evento('warn', evento, mensagem, campos);
  }
}

export type { NivelLog };
