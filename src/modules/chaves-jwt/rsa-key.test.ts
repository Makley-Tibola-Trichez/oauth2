import { describe, expect, it } from 'bun:test';
import { calcularKid, chavePublicaParaJwk, gerarParDeChaves } from './rsa-key';

describe('rsa-key', () => {
  it('gera um par de chaves RSA com kid derivado da chave pública', async () => {
    const par = await gerarParDeChaves();

    expect(par.chavePrivadaPem).toContain('PRIVATE KEY');
    expect(par.chavePublicaPem).toContain('PUBLIC KEY');
    expect(par.algoritmo).toBe('RS256');
    expect(par.kid).toBe(await calcularKid(par.chavePublicaPem));
  });

  it('o kid é determinístico para a mesma chave pública', async () => {
    const par = await gerarParDeChaves();

    const kid1 = await calcularKid(par.chavePublicaPem);
    const kid2 = await calcularKid(par.chavePublicaPem);

    expect(kid1).toBe(kid2);
  });

  it('pares diferentes produzem kids diferentes', async () => {
    const par1 = await gerarParDeChaves();
    const par2 = await gerarParDeChaves();

    expect(par1.kid).not.toBe(par2.kid);
  });

  it('converte a chave pública para JWK sem expor material privado', async () => {
    const par = await gerarParDeChaves();

    const jwk = await chavePublicaParaJwk(par.chavePublicaPem, par.kid);

    expect(jwk.kty).toBe('RSA');
    expect(jwk.kid).toBe(par.kid);
    expect(jwk.alg).toBe('RS256');
    expect(jwk.use).toBe('sig');
    expect(jwk.n).toBeTruthy();
    expect(jwk.e).toBeTruthy();
    expect(jwk.d).toBeUndefined();
  });
});
