export {
  EVENTOS_AUDITORIA,
  type EventoAuditoria,
  registrarAuditoria,
  registrarFalhaAuditoria,
} from './audit';
export { configurarNivelDeLog, logger, type NivelLog } from './logger';
export { campoESensivel, redigir, redigirCampos, VALOR_REDIGIDO } from './redaction';
export { definirRequestId, obterRequestId } from './request-context';
export { CABECALHO_REQUEST_ID, requestLogPlugin } from './request-log.plugin';
