/**
 * Logger que emite uma linha JSON por evento em stdout, pronta para coleta
 * pelo Grafana Loki.
 *
 * A escrita passa por um "sink" trocável (`definirEscritorDeLog`) em vez de
 * chamar `process.stdout.write` diretamente — os testes injetam um
 * coletor em memória, sem precisar mockar I/O global do processo.
 */

import { redigirCampos } from './redaction';
import { obterRequestId } from './request-context';

export type NivelLog = 'debug' | 'info' | 'warn' | 'error';
export type EscritorDeLog = (linha: string) => void;

const PESO_NIVEL: Record<NivelLog, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let nivelMinimo: NivelLog = 'info';
let escritor: EscritorDeLog = (linha) => {
  process.stdout.write(linha);
};

/** Chamado uma vez, na subida da aplicação, com `config.logLevel`. */
export function configurarNivelDeLog(nivel: NivelLog): void {
  nivelMinimo = nivel;
}

/** Troca o destino das linhas de log. Usado pelos testes; nunca em produção. */
export function definirEscritorDeLog(fn: EscritorDeLog): void {
  escritor = fn;
}

function escrever(
  nivel: NivelLog,
  mensagem: string,
  contexto?: string,
  camposExtras?: Record<string, unknown>,
): void {
  if (PESO_NIVEL[nivel] < PESO_NIVEL[nivelMinimo]) {
    return;
  }

  const linha: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    nivel: nivel.toUpperCase(),
    logger: contexto ?? 'app',
    mensagem,
  };

  const requestId = obterRequestId();
  if (requestId) {
    linha.requestId = requestId;
  }
  if (camposExtras) {
    Object.assign(linha, redigirCampos(camposExtras));
  }

  escritor(`${JSON.stringify(linha)}\n`);
}

export const logger = {
  debug(mensagem: string, contexto?: string, campos?: Record<string, unknown>): void {
    escrever('debug', mensagem, contexto, campos);
  },
  info(mensagem: string, contexto?: string, campos?: Record<string, unknown>): void {
    escrever('info', mensagem, contexto, campos);
  },
  warn(mensagem: string, contexto?: string, campos?: Record<string, unknown>): void {
    escrever('warn', mensagem, contexto, campos);
  },
  error(mensagem: string, contexto?: string, campos?: Record<string, unknown>): void {
    escrever('error', mensagem, contexto, campos);
  },
};
