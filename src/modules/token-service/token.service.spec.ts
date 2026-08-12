import { decodeProtectedHeader, importJWK, jwtVerify, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { AppConfigService } from '../../config/app-config.service';
import { chavePublicaParaJwk, gerarParDeChaves, KeyManagerService } from '../chaves-jwt';
import { TokenExpiradoError, TokenInvalidoError } from './token.errors';
import { TokenService } from './token.service';
import { TIPO_TOKEN } from './token.types';

const ISSUER = 'https://auth.testes';
const AUDIENCE = 'microservicos-de-teste';

async function criarAmbiente(expiracaoMinutos = 30) {
  const par = await gerarParDeChaves();
  const registroPublico = {
    kid: par.kid,
    algoritmo: par.algoritmo,
    chavePublicaPem: par.chavePublicaPem,
  };

  const keyManager = mock<KeyManagerService>();
  keyManager.obterChaveDeAssinatura.mockResolvedValue({
    kid: par.kid,
    algoritmo: par.algoritmo,
    chavePrivadaPem: par.chavePrivadaPem,
  });
  keyManager.obterChavePublica.mockImplementation(async (kid: string) =>
    kid === par.kid ? registroPublico : null,
  );

  const config = mock<AppConfigService>({
    jwtIssuer: ISSUER,
    jwtAudience: AUDIENCE,
    accessTokenExpireMinutes: expiracaoMinutos,
  });

  return { servico: new TokenService(keyManager, config), keyManager, config, par };
}

describe('TokenService', () => {
  it('o token carrega todas as claims exigidas', async () => {
    const { servico, par } = await criarAmbiente();

    const emitido = await servico.emitir({
      sub: 'app_rpa',
      tipo: TIPO_TOKEN.RPA,
      rpaId: 'rpa_custeio',
    });

    const claims = await servico.validar(emitido.accessToken);
    expect(claims.sub).toBe('app_rpa');
    expect(claims.tipo).toBe(TIPO_TOKEN.RPA);
    expect(claims.rpaId).toBe('rpa_custeio');
    expect(claims.iss).toBe(ISSUER);
    expect(claims.aud).toBe(AUDIENCE);
    expect(claims.exp.getTime() - claims.iat.getTime()).toBe(30 * 60 * 1000);
    expect(emitido.kid).toBe(par.kid);
  });

  it('o cabeçalho traz o kid da chave ativa', async () => {
    const { servico, par } = await criarAmbiente();

    const emitido = await servico.emitir({ sub: 'svc', tipo: TIPO_TOKEN.SERVICE });

    const cabecalho = decodeProtectedHeader(emitido.accessToken);
    expect(cabecalho.kid).toBe(par.kid);
    expect(cabecalho.alg).toBe('RS256');
  });

  it('cada token tem jti próprio', async () => {
    const { servico } = await criarAmbiente();

    const primeiro = await servico.emitir({ sub: 'svc', tipo: TIPO_TOKEN.SERVICE });
    const segundo = await servico.emitir({ sub: 'svc', tipo: TIPO_TOKEN.SERVICE });

    expect(primeiro.jti).not.toBe(segundo.jti);
  });

  it('o microsserviço valida localmente com a chave pública (via JWKS)', async () => {
    const { servico, par } = await criarAmbiente();

    const emitido = await servico.emitir({ sub: 'svc', tipo: TIPO_TOKEN.SERVICE });
    const jwk = await chavePublicaParaJwk(par.chavePublicaPem, par.kid);
    const chavePublica = await importJWK(jwk, 'RS256');

    const { payload } = await jwtVerify(emitido.accessToken, chavePublica, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    expect(payload.sub).toBe('svc');
  });

  it('token expirado é recusado', async () => {
    const { servico } = await criarAmbiente(0);

    const emitido = await servico.emitir({ sub: 'svc', tipo: TIPO_TOKEN.SERVICE });
    await new Promise((resolve) => setTimeout(resolve, 1100));

    await expect(servico.validar(emitido.accessToken)).rejects.toThrow(TokenExpiradoError);
  });

  it('token adulterado é recusado', async () => {
    const { servico } = await criarAmbiente();

    const emitido = await servico.emitir({ sub: 'svc', tipo: TIPO_TOKEN.SERVICE });
    const adulterado = `${emitido.accessToken.slice(0, -4)}aaaa`;

    await expect(servico.validar(adulterado)).rejects.toThrow(TokenInvalidoError);
  });

  it('recusa token de outro emissor', async () => {
    const par = await gerarParDeChaves();
    const registroPublico = {
      kid: par.kid,
      algoritmo: par.algoritmo,
      chavePublicaPem: par.chavePublicaPem,
    };

    const keyManager = mock<KeyManagerService>();
    keyManager.obterChaveDeAssinatura.mockResolvedValue({
      kid: par.kid,
      algoritmo: par.algoritmo,
      chavePrivadaPem: par.chavePrivadaPem,
    });
    keyManager.obterChavePublica.mockResolvedValue(registroPublico);

    const outroEmissor = new TokenService(
      keyManager,
      mock<AppConfigService>({
        jwtIssuer: 'https://auth.intruso',
        jwtAudience: AUDIENCE,
        accessTokenExpireMinutes: 30,
      }),
    );
    const emitido = await outroEmissor.emitir({ sub: 'svc', tipo: TIPO_TOKEN.SERVICE });

    const servico = new TokenService(
      keyManager,
      mock<AppConfigService>({
        jwtIssuer: ISSUER,
        jwtAudience: AUDIENCE,
        accessTokenExpireMinutes: 30,
      }),
    );
    await expect(servico.validar(emitido.accessToken)).rejects.toThrow(TokenInvalidoError);
  });

  it('recusa token para outra audiência', async () => {
    const { servico, keyManager, par } = await criarAmbiente();

    const outraAudiencia = new TokenService(
      keyManager,
      mock<AppConfigService>({
        jwtIssuer: ISSUER,
        jwtAudience: 'outro-publico',
        accessTokenExpireMinutes: 30,
      }),
    );
    const emitido = await outraAudiencia.emitir({ sub: 'svc', tipo: TIPO_TOKEN.SERVICE });

    await expect(servico.validar(emitido.accessToken)).rejects.toThrow(TokenInvalidoError);
    expect(par.kid).toBeTruthy();
  });

  it('recusa token sem kid', async () => {
    const { servico } = await criarAmbiente();

    const semKid = await new SignJWT({ tipo: 'service' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('x')
      .sign(new TextEncoder().encode('segredo-de-teste-com-32-bytes-ok'));

    await expect(servico.validar(semKid)).rejects.toThrow(TokenInvalidoError);
  });

  it('recusa troca de algoritmo (algorithm confusion)', async () => {
    const { servico, par } = await criarAmbiente();

    // Assina com HS256 usando um kid válido — o algoritmo REGISTRADO para a
    // chave é RS256, então isto precisa ser recusado mesmo com kid correto.
    const forjado = await new SignJWT({ tipo: TIPO_TOKEN.SERVICE })
      .setProtectedHeader({ alg: 'HS256', kid: par.kid })
      .setSubject('intruso')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setJti('forjado')
      .sign(new TextEncoder().encode('segredo-de-teste-com-32-bytes-ok'));

    await expect(servico.validar(forjado)).rejects.toThrow(TokenInvalidoError);
  });

  it('recusa token vazio', async () => {
    const { servico } = await criarAmbiente();
    await expect(servico.validar('')).rejects.toThrow(TokenInvalidoError);
  });

  it('recusa kid desconhecido', async () => {
    const { servico } = await criarAmbiente();

    const comKidDesconhecido = await new SignJWT({ tipo: 'service' })
      .setProtectedHeader({ alg: 'HS256', kid: 'kid-que-nao-existe' })
      .setSubject('x')
      .sign(new TextEncoder().encode('segredo-de-teste-com-32-bytes-ok'));

    await expect(servico.validar(comKidDesconhecido)).rejects.toThrow(TokenInvalidoError);
  });
});
