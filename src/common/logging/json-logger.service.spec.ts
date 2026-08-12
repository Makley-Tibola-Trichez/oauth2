import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonLoggerService } from './json-logger.service';
import { runWithRequestContext } from './request-context';

function capturarLinhas(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown>[] {
  return spy.mock.calls.map(([linha]) => JSON.parse(String(linha).trim()));
}

describe('JsonLoggerService', () => {
  let escrita: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    escrita = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    escrita.mockRestore();
  });

  it('emite uma linha JSON por chamada, com timestamp, nível e mensagem', () => {
    new JsonLoggerService('info').log('Serviço iniciado', 'Bootstrap');

    const [linha] = capturarLinhas(escrita);
    expect(linha.nivel).toBe('INFO');
    expect(linha.logger).toBe('Bootstrap');
    expect(linha.mensagem).toBe('Serviço iniciado');
    expect(typeof linha.timestamp).toBe('string');
  });

  it('respeita o nível mínimo configurado', () => {
    const logger = new JsonLoggerService('warn');

    logger.debug('não deveria aparecer');
    logger.log('não deveria aparecer');
    logger.warn('deveria aparecer');
    logger.error('deveria aparecer também');

    const linhas = capturarLinhas(escrita);
    expect(linhas).toHaveLength(2);
    expect(linhas.map((l) => l.nivel)).toEqual(['WARN', 'ERROR']);
  });

  it('inclui o requestId quando existe contexto de requisição', () => {
    const logger = new JsonLoggerService('info');

    runWithRequestContext('req-123', () => logger.log('dentro do contexto'));
    logger.log('fora do contexto');

    const linhas = capturarLinhas(escrita);
    expect(linhas[0].requestId).toBe('req-123');
    expect(linhas[1].requestId).toBeUndefined();
  });

  it('redige segredos passados como campos extras de evento', () => {
    const logger = new JsonLoggerService('info');

    logger.evento('info', 'autenticacao_sucesso', 'Token emitido', {
      clientId: 'svc_x',
      clientSecret: 'nao-pode-vazar',
    });

    const [linha] = capturarLinhas(escrita);
    expect(linha.evento).toBe('autenticacao_sucesso');
    expect(linha.clientId).toBe('svc_x');
    expect(linha.clientSecret).toBe('***');
    expect(JSON.stringify(linha)).not.toContain('nao-pode-vazar');
  });

  it('anexa o stack trace de erro sob a chave stack', () => {
    new JsonLoggerService('info').error('Falhou', 'Error: boom\n  at x', 'Contexto');

    const [linha] = capturarLinhas(escrita);
    expect(linha.stack).toContain('boom');
  });
});
