"""Geração, validação e expiração dos JWTs."""

from __future__ import annotations

import time

import jwt as pyjwt
import pytest

from app.security.jwt_service import (
    ServicoJwt,
    TipoToken,
    TokenExpiradoError,
    TokenInvalidoError,
)
from app.security.key_manager import GerenciadorChaves
from tests.conftest import AUDIENCE_DE_TESTE, ISSUER_DE_TESTE


async def test_token_carrega_todas_as_claims_exigidas(servico_jwt: ServicoJwt) -> None:
    emitido = await servico_jwt.emitir(sub="app_rpa", tipo=TipoToken.RPA, rpa_id="rpa_custeio")

    payload = pyjwt.decode(
        emitido.access_token,
        options={"verify_signature": False},
        audience=AUDIENCE_DE_TESTE,
    )
    assert set(payload) == {"sub", "tipo", "iss", "aud", "iat", "exp", "jti", "rpa_id"}
    assert payload["iss"] == ISSUER_DE_TESTE
    assert payload["aud"] == AUDIENCE_DE_TESTE
    assert payload["exp"] - payload["iat"] == 30 * 60


async def test_cabecalho_traz_o_kid_da_chave_ativa(
    servico_jwt: ServicoJwt,
    gerenciador_chaves: GerenciadorChaves,
) -> None:
    emitido = await servico_jwt.emitir(sub="svc", tipo=TipoToken.SERVICE)

    cabecalho = pyjwt.get_unverified_header(emitido.access_token)
    chave_ativa = await gerenciador_chaves.obter_chave_de_assinatura()
    assert cabecalho["kid"] == chave_ativa.kid == emitido.kid
    assert cabecalho["alg"] == "RS256"


async def test_cada_token_tem_jti_proprio(servico_jwt: ServicoJwt) -> None:
    primeiro = await servico_jwt.emitir(sub="svc", tipo=TipoToken.SERVICE)
    segundo = await servico_jwt.emitir(sub="svc", tipo=TipoToken.SERVICE)
    assert primeiro.jti != segundo.jti


async def test_microsservico_valida_localmente_com_a_chave_publica(
    servico_jwt: ServicoJwt,
    gerenciador_chaves: GerenciadorChaves,
) -> None:
    """É assim que os consumidores devem validar: JWKS + verificação local."""
    emitido = await servico_jwt.emitir(sub="svc", tipo=TipoToken.SERVICE)
    jwks = await gerenciador_chaves.obter_jwks()

    chave = pyjwt.PyJWK.from_dict(jwks["keys"][0])
    payload = pyjwt.decode(
        emitido.access_token,
        chave.key,
        algorithms=["RS256"],
        issuer=ISSUER_DE_TESTE,
        audience=AUDIENCE_DE_TESTE,
    )
    assert payload["sub"] == "svc"


async def test_token_expirado_e_recusado(gerenciador_chaves: GerenciadorChaves) -> None:
    servico_expirado = ServicoJwt(
        gerenciador_chaves,
        issuer=ISSUER_DE_TESTE,
        audience=AUDIENCE_DE_TESTE,
        expiracao_minutos=0,
    )
    emitido = await servico_expirado.emitir(sub="svc", tipo=TipoToken.SERVICE)
    time.sleep(1.1)

    with pytest.raises(TokenExpiradoError):
        await servico_expirado.validar(emitido.access_token)


async def test_token_adulterado_e_recusado(servico_jwt: ServicoJwt) -> None:
    emitido = await servico_jwt.emitir(sub="svc", tipo=TipoToken.SERVICE)

    with pytest.raises(TokenInvalidoError):
        await servico_jwt.validar(emitido.access_token[:-4] + "aaaa")


async def test_recusa_token_de_outro_emissor(gerenciador_chaves: GerenciadorChaves) -> None:
    outro_emissor = ServicoJwt(
        gerenciador_chaves,
        issuer="https://auth.intruso",
        audience=AUDIENCE_DE_TESTE,
    )
    emitido = await outro_emissor.emitir(sub="svc", tipo=TipoToken.SERVICE)

    servico = ServicoJwt(gerenciador_chaves, issuer=ISSUER_DE_TESTE, audience=AUDIENCE_DE_TESTE)
    with pytest.raises(TokenInvalidoError):
        await servico.validar(emitido.access_token)


async def test_recusa_token_para_outra_audiencia(gerenciador_chaves: GerenciadorChaves) -> None:
    outra_audiencia = ServicoJwt(
        gerenciador_chaves,
        issuer=ISSUER_DE_TESTE,
        audience="outro-publico",
    )
    emitido = await outra_audiencia.emitir(sub="svc", tipo=TipoToken.SERVICE)

    servico = ServicoJwt(gerenciador_chaves, issuer=ISSUER_DE_TESTE, audience=AUDIENCE_DE_TESTE)
    with pytest.raises(TokenInvalidoError):
        await servico.validar(emitido.access_token)


async def test_recusa_token_sem_kid(servico_jwt: ServicoJwt) -> None:
    token = pyjwt.encode({"sub": "x"}, "segredo-de-teste-com-32-bytes-ok", algorithm="HS256")

    with pytest.raises(TokenInvalidoError):
        await servico_jwt.validar(token)


async def test_recusa_troca_de_algoritmo(
    servico_jwt: ServicoJwt,
    gerenciador_chaves: GerenciadorChaves,
) -> None:
    """Assinar com HS256 usando um kid válido não pode passar pela validação."""
    chave_ativa = await gerenciador_chaves.obter_chave_de_assinatura()
    forjado = pyjwt.encode(
        {
            "sub": "intruso",
            "tipo": "service",
            "iss": ISSUER_DE_TESTE,
            "aud": AUDIENCE_DE_TESTE,
            "iat": 1,
            "exp": 9999999999,
            "jti": "forjado",
        },
        "segredo-de-teste-com-32-bytes-ok",
        algorithm="HS256",
        headers={"kid": chave_ativa.kid},
    )

    with pytest.raises(TokenInvalidoError):
        await servico_jwt.validar(forjado)


async def test_recusa_token_vazio(servico_jwt: ServicoJwt) -> None:
    with pytest.raises(TokenInvalidoError):
        await servico_jwt.validar("")
