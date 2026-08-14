import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { configurarNivelDeLog, definirEscritorDeLog, logger } from './logger';
import { definirRequestId } from './request-context';

function criarColetor(): { linhas: Record<string, unknown>[]; capturar: (l: string) => void } {
  const linhas: Record<string, unknown>[] = [];
  return {
    linhas,
    capturar: (linha: string) => linhas.push(JSON.parse(linha.trim())),
  };
}

describe('logger', () => {
  beforeEach(() => {
    configurarNivelDeLog('info');
  });

  afterEach(() => {
    // Não deixa o coletor deste arquivo capturar logs de outros testes.
    definirEscritorDeLog(() => {});
  });

  it('emite uma linha JSON por chamada, com timestamp, nível e mensagem', () => {
    const { linhas, capturar } = criarColetor();
    definirEscritorDeLog(capturar);

    logger.info('Serviço iniciado', 'bootstrap');

    expect(linhas[0]?.nivel).toBe('INFO');
    expect(linhas[0]?.logger).toBe('bootstrap');
    expect(linhas[0]?.mensagem).toBe('Serviço iniciado');
    expect(typeof linhas[0]?.timestamp).toBe('string');
  });

  it('respeita o nível mínimo configurado', () => {
    const { linhas, capturar } = criarColetor();
    definirEscritorDeLog(capturar);
    configurarNivelDeLog('warn');

    logger.debug('não deveria aparecer');
    logger.info('não deveria aparecer');
    logger.warn('deveria aparecer');
    logger.error('deveria aparecer também');

    expect(linhas).toHaveLength(2);
    expect(linhas.map((l) => l.nivel)).toEqual(['WARN', 'ERROR']);
  });

  it('inclui o requestId quando existe contexto de requisição', () => {
    const { linhas, capturar } = criarColetor();
    definirEscritorDeLog(capturar);

    definirRequestId('req-123');
    logger.info('dentro do contexto');

    expect(linhas[0]?.requestId).toBe('req-123');
  });

  it('redige segredos passados como campos extras', () => {
    const { linhas, capturar } = criarColetor();
    definirEscritorDeLog(capturar);

    logger.info('Token emitido', 'auditoria', {
      evento: 'autenticacao_sucesso',
      clientId: 'svc_x',
      clientSecret: 'nao-pode-vazar',
    });

    expect(linhas[0]?.evento).toBe('autenticacao_sucesso');
    expect(linhas[0]?.clientId).toBe('svc_x');
    expect(linhas[0]?.clientSecret).toBe('***');
    expect(JSON.stringify(linhas[0])).not.toContain('nao-pode-vazar');
  });
});
