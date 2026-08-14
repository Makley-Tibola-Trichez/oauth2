/**
 * Registro dos eventos de auditoria do serviço.
 *
 * Nomes de evento estáveis, para permitir consultas no Loki. Passa sempre
 * pelo logger estruturado (e, portanto, pelo filtro de redação).
 */

import { logger } from './logger';

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

export function registrarAuditoria(
  evento: EventoAuditoria,
  mensagem: string,
  campos: Record<string, unknown> = {},
): void {
  logger.info(mensagem, 'auditoria', { evento, ...campos });
}

export function registrarFalhaAuditoria(
  evento: EventoAuditoria,
  mensagem: string,
  campos: Record<string, unknown> = {},
): void {
  logger.warn(mensagem, 'auditoria', { evento, ...campos });
}
