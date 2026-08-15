import { beforeEach, describe, expect, it } from 'bun:test';
import { exportJWK, importSPKI, SignJWT } from 'jose';
import { STATUS_CHAVE } from '../../shared/domain/status';
import { TokenExpiradoError, TokenInvalidoError } from '../../shared/errors';
import { FakeVaultClient } from '../../vault/fake-client';
import { KeyManagerService } from '../chaves-jwt/key-manager.service';
import { emitirToken, validarToken } from './token.service';
import { TIPO_TOKEN } from './token.types';

const ISSUER = 'https://auth.exemplo.local';
const AUDIENCE = 'api-interna';

interface RegistroChave {
  kid: string;
  chavePublicaPem: string;
  algoritmo: string;
  status: string;
  criadoEm: Date;
  expiraEm: Date | null;
}

/** Fake mínimo do delegate `prisma.chaveJwt`, só o necessário para o KeyManagerService. */
function criarDbFake() {
  const linhas = new Map<string, RegistroChave>();

  const chaveJwt = {
    findFirst: async ({ where }: { where?: { status?: unknown } } = {}) => {
      for (const linha of linhas.values()) {
        if (where?.status === undefined || linha.status === where.status) return { ...linha };
      }
      return null;
    },
    findUnique: async ({ where }: { where: { kid: string } }) => {
      const linha = linhas.get(where.kid);
      return linha ? { ...linha } : null;
    },
    findMany: async () => [...linhas.values()].map((l) => ({ ...l })),
    create: async ({ data }: { data: Partial<RegistroChave> & { kid: string } }) => {
      const linha: RegistroChave = {
        chavePublicaPem: '',
        algoritmo: 'RS256',
        status: STATUS_CHAVE.ATIVA,
        criadoEm: new Date(),
        expiraEm: null,
        ...data,
      };
      linhas.set(linha.kid, linha);
      return { ...linha };
    },
    update: async ({ where, data }: { where: { kid: string }; data: Partial<RegistroChave> }) => {
      const linha = linhas.get(where.kid);
      if (!linha) throw new Error(`chave ${where.kid} não encontrada`);
      Object.assign(linha, data);
      return { ...linha };
    },
  };

  type Db = {
    chaveJwt: typeof chaveJwt;
    $transaction: (fn: (tx: Db) => Promise<unknown>) => Promise<unknown>;
  };

  const db: Db = {
    chaveJwt,
    $transaction: async (fn) => fn(db),
  };

  return db as never;
}

describe('token.service', () => {
  let gerenciador: KeyManagerService;

  beforeEach(async () => {
    gerenciador = new KeyManagerService(criarDbFake(), new FakeVaultClient(), 35);
    await gerenciador.garantirChaveAtiva();
  });

  it('emite um token com todas as claims obrigatórias e o kid no cabeçalho', async () => {
    const emitido = await emitirToken(
      { sub: 'servico-a', tipo: TIPO_TOKEN.SERVICE },
      gerenciador,
      ISSUER,
      AUDIENCE,
      30,
    );

    expect(emitido.tokenType).toBe('Bearer');
    expect(emitido.expiresIn).toBe(30 * 60);
    expect(emitido.kid).toBeTruthy();

    const [, payloadB64] = emitido.accessToken.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64 ?? '', 'base64url').toString('utf8'));
    expect(payload).toMatchObject({
      sub: 'servico-a',
      iss: ISSUER,
      aud: AUDIENCE,
      tipo: TIPO_TOKEN.SERVICE,
    });
    expect(payload.jti).toBeTruthy();
    expect(payload.iat).toBeTypeOf('number');
    expect(payload.exp).toBeTypeOf('number');

    const cabecalho = JSON.parse(
      Buffer.from(emitido.accessToken.split('.')[0] ?? '', 'base64url').toString('utf8'),
    );
    expect(cabecalho.kid).toBe(emitido.kid);
    expect(cabecalho.alg).toBe('RS256');
  });

  it('inclui o rpaId quando informado, e omite quando ausente', async () => {
    const deRpa = await emitirToken(
      { sub: 'app_rpa', tipo: TIPO_TOKEN.RPA, rpaId: 'rpa_custeio' },
      gerenciador,
      ISSUER,
      AUDIENCE,
    );
    const claimsRpa = await validarToken(deRpa.accessToken, gerenciador, ISSUER, AUDIENCE);
    expect(claimsRpa.rpaId).toBe('rpa_custeio');

    const deServico = await emitirToken(
      { sub: 'servico-a', tipo: TIPO_TOKEN.SERVICE },
      gerenciador,
      ISSUER,
      AUDIENCE,
    );
    const claimsServico = await validarToken(deServico.accessToken, gerenciador, ISSUER, AUDIENCE);
    expect(claimsServico.rpaId).toBeUndefined();
  });

  it('cada token emitido tem um jti único', async () => {
    const params = { sub: 'servico-a', tipo: TIPO_TOKEN.SERVICE } as const;
    const primeiro = await emitirToken(params, gerenciador, ISSUER, AUDIENCE);
    const segundo = await emitirToken(params, gerenciador, ISSUER, AUDIENCE);

    expect(primeiro.jti).not.toBe(segundo.jti);
  });

  it('valida localmente com a chave pública exportada do JWKS', async () => {
    const emitido = await emitirToken(
      { sub: 'servico-a', tipo: TIPO_TOKEN.SERVICE },
      gerenciador,
      ISSUER,
      AUDIENCE,
    );

    const jwks = await gerenciador.obterJwks();
    const jwk = jwks.keys.find((k) => k.kid === emitido.kid);
    expect(jwk).toBeDefined();

    const claims = await validarToken(emitido.accessToken, gerenciador, ISSUER, AUDIENCE);
    expect(claims.sub).toBe('servico-a');
    expect(claims.tipo).toBe(TIPO_TOKEN.SERVICE);
    expect(claims.jti).toBe(emitido.jti);
  });

  it('rejeita token expirado', async () => {
    const emitido = await emitirToken(
      { sub: 'servico-a', tipo: TIPO_TOKEN.SERVICE },
      gerenciador,
      ISSUER,
      AUDIENCE,
      -1, // expiração já no passado
    );

    await expect(validarToken(emitido.accessToken, gerenciador, ISSUER, AUDIENCE)).rejects.toThrow(
      TokenExpiradoError,
    );
  });

  it('rejeita token adulterado (assinatura não confere)', async () => {
    const emitido = await emitirToken(
      { sub: 'servico-a', tipo: TIPO_TOKEN.SERVICE },
      gerenciador,
      ISSUER,
      AUDIENCE,
    );

    const partes = emitido.accessToken.split('.');
    const payloadAdulterado = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(partes[1] ?? '', 'base64url').toString()),
        sub: 'invasor',
      }),
    ).toString('base64url');
    const adulterado = `${partes[0]}.${payloadAdulterado}.${partes[2]}`;

    await expect(validarToken(adulterado, gerenciador, ISSUER, AUDIENCE)).rejects.toThrow(
      TokenInvalidoError,
    );
  });

  it('rejeita issuer incorreto', async () => {
    const emitido = await emitirToken(
      { sub: 'servico-a', tipo: TIPO_TOKEN.SERVICE },
      gerenciador,
      ISSUER,
      AUDIENCE,
    );

    await expect(
      validarToken(emitido.accessToken, gerenciador, 'https://outro-issuer', AUDIENCE),
    ).rejects.toThrow(TokenInvalidoError);
  });

  it('rejeita audience incorreta', async () => {
    const emitido = await emitirToken(
      { sub: 'servico-a', tipo: TIPO_TOKEN.SERVICE },
      gerenciador,
      ISSUER,
      AUDIENCE,
    );

    await expect(
      validarToken(emitido.accessToken, gerenciador, ISSUER, 'outra-audience'),
    ).rejects.toThrow(TokenInvalidoError);
  });

  it('rejeita token sem kid no cabeçalho', async () => {
    const chave = await gerenciador.obterChaveDeAssinatura();
    const { importPKCS8 } = await import('jose');
    const chavePrivada = await importPKCS8(chave.chavePrivadaPem, chave.algoritmo);

    const semKid = await new SignJWT({ tipo: TIPO_TOKEN.SERVICE })
      .setProtectedHeader({ alg: chave.algoritmo })
      .setSubject('servico-a')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('30m')
      .setJti(crypto.randomUUID())
      .sign(chavePrivada);

    await expect(validarToken(semKid, gerenciador, ISSUER, AUDIENCE)).rejects.toThrow(
      TokenInvalidoError,
    );
  });

  it('rejeita kid desconhecido', async () => {
    const chave = await gerenciador.obterChaveDeAssinatura();
    const { importPKCS8 } = await import('jose');
    const chavePrivada = await importPKCS8(chave.chavePrivadaPem, chave.algoritmo);

    const kidFalso = await new SignJWT({ tipo: TIPO_TOKEN.SERVICE })
      .setProtectedHeader({ alg: chave.algoritmo, kid: 'kid-inexistente' })
      .setSubject('servico-a')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('30m')
      .setJti(crypto.randomUUID())
      .sign(chavePrivada);

    await expect(validarToken(kidFalso, gerenciador, ISSUER, AUDIENCE)).rejects.toThrow(
      TokenInvalidoError,
    );
  });

  it('rejeita token vazio', async () => {
    await expect(validarToken('', gerenciador, ISSUER, AUDIENCE)).rejects.toThrow(
      TokenInvalidoError,
    );
  });

  it('recusa algorithm confusion: HS256 assinado com a chave pública (PEM) como segredo', async () => {
    const emitido = await emitirToken(
      { sub: 'servico-a', tipo: TIPO_TOKEN.SERVICE },
      gerenciador,
      ISSUER,
      AUDIENCE,
    );
    const chavePublica = await gerenciador.obterChavePublica(emitido.kid);
    if (!chavePublica) throw new Error('chave pública não encontrada no teste');

    const segredoForjado = new TextEncoder().encode(chavePublica.chavePublicaPem);
    const forjado = await new SignJWT({ tipo: TIPO_TOKEN.SERVICE })
      .setProtectedHeader({ alg: 'HS256', kid: emitido.kid })
      .setSubject('invasor')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('30m')
      .setJti(crypto.randomUUID())
      .sign(segredoForjado);

    // A validação usa o algoritmo REGISTRADO para o kid (RS256), nunca o do
    // cabeçalho do token forjado — jose recusa antes mesmo de olhar a assinatura.
    await expect(validarToken(forjado, gerenciador, ISSUER, AUDIENCE)).rejects.toThrow(
      TokenInvalidoError,
    );
  });

  it('a chave pública exportada como JWK bate com a usada para validar', async () => {
    const chave = await gerenciador.obterChaveDeAssinatura();
    const chavePublica = await gerenciador.obterChavePublica(chave.kid);
    if (!chavePublica) throw new Error('chave pública não encontrada no teste');

    const chaveImportada = await importSPKI(chavePublica.chavePublicaPem, chavePublica.algoritmo);
    const jwk = await exportJWK(chaveImportada);
    expect(jwk.kty).toBe('RSA');
  });
});
