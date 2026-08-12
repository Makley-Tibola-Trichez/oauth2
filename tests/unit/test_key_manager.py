"""Ciclo de vida das chaves: privada no Vault, metadados no banco, rotação."""

from __future__ import annotations

from datetime import timedelta

import pytest

from app.models.base import agora_utc
from app.models.enums import StatusChave
from app.security.jwt_service import ServicoJwt, TipoToken, TokenInvalidoError
from app.security.key_manager import (
    CacheChavesPrivadas,
    ChaveDeAssinaturaIndisponivelError,
    GerenciadorChaves,
)
from app.vault.caminhos import caminho_chave_privada
from app.vault.fake_client import FakeVaultClient
from tests.conftest import AUDIENCE_DE_TESTE, ISSUER_DE_TESTE
from tests.fakes import FakeChaveJwtRepositorio


async def test_chave_privada_fica_apenas_no_vault(
    gerenciador_chaves: GerenciadorChaves,
    chave_repositorio: FakeChaveJwtRepositorio,
    vault: FakeVaultClient,
) -> None:
    chave = await gerenciador_chaves.obter_chave_de_assinatura()

    registro = chave_repositorio.itens[chave.kid]
    assert "PRIVATE KEY" not in registro.chave_publica_pem
    assert "PUBLIC KEY" in registro.chave_publica_pem

    segredo = await vault.ler_segredo(caminho_chave_privada(chave.kid))
    assert segredo is not None
    assert "PRIVATE KEY" in segredo["chave_privada_pem"]


async def test_jwks_nao_depende_do_vault(
    gerenciador_chaves: GerenciadorChaves,
    vault: FakeVaultClient,
) -> None:
    vault.disponivel = False

    jwks = await gerenciador_chaves.obter_jwks()
    assert len(jwks["keys"]) == 1
    assert jwks["keys"][0]["kty"] == "RSA"
    assert {"kid", "n", "e", "alg", "use"} <= set(jwks["keys"][0])


async def test_rotacao_troca_a_ativa_e_mantem_a_anterior_no_jwks(
    gerenciador_chaves: GerenciadorChaves,
    chave_repositorio: FakeChaveJwtRepositorio,
) -> None:
    anterior = await chave_repositorio.buscar_ativa()
    assert anterior is not None

    nova = await gerenciador_chaves.rotacionar()

    assert nova.kid != anterior.kid
    assert StatusChave(nova.status) is StatusChave.ATIVA
    assert StatusChave(anterior.status) is StatusChave.EM_ROTACAO
    assert anterior.expira_em is not None

    kids_publicados = {c["kid"] for c in (await gerenciador_chaves.obter_jwks())["keys"]}
    assert kids_publicados == {anterior.kid, nova.kid}


async def test_token_assinado_antes_da_rotacao_continua_valido(
    gerenciador_chaves: GerenciadorChaves,
    servico_jwt: ServicoJwt,
) -> None:
    emitido = await servico_jwt.emitir(sub="svc", tipo=TipoToken.SERVICE)

    await gerenciador_chaves.rotacionar()

    claims = await servico_jwt.validar(emitido.access_token)
    assert claims.sub == "svc"

    novo = await servico_jwt.emitir(sub="svc", tipo=TipoToken.SERVICE)
    assert novo.kid != emitido.kid


async def test_chave_aposentada_deixa_de_validar_e_some_do_vault(
    gerenciador_chaves: GerenciadorChaves,
    chave_repositorio: FakeChaveJwtRepositorio,
    servico_jwt: ServicoJwt,
    vault: FakeVaultClient,
) -> None:
    emitido = await servico_jwt.emitir(sub="svc", tipo=TipoToken.SERVICE)
    antiga = await chave_repositorio.buscar_ativa()
    assert antiga is not None

    await gerenciador_chaves.rotacionar()
    antiga.expira_em = agora_utc() - timedelta(minutes=1)

    aposentadas = await gerenciador_chaves.aposentar_chaves_expiradas()

    assert aposentadas == [antiga.kid]
    assert StatusChave(antiga.status) is StatusChave.APOSENTADA
    assert await vault.ler_segredo(caminho_chave_privada(antiga.kid)) is None
    assert len((await gerenciador_chaves.obter_jwks())["keys"]) == 1
    with pytest.raises(TokenInvalidoError):
        await servico_jwt.validar(emitido.access_token)


async def test_nao_aposenta_antes_do_periodo_de_graca(
    gerenciador_chaves: GerenciadorChaves,
) -> None:
    await gerenciador_chaves.rotacionar()

    assert await gerenciador_chaves.aposentar_chaves_expiradas() == []
    assert len((await gerenciador_chaves.obter_jwks())["keys"]) == 2


async def test_garantir_chave_ativa_e_idempotente(
    gerenciador_chaves: GerenciadorChaves,
    chave_repositorio: FakeChaveJwtRepositorio,
) -> None:
    primeira = await gerenciador_chaves.garantir_chave_ativa()
    segunda = await gerenciador_chaves.garantir_chave_ativa()

    assert primeira.kid == segunda.kid
    assert len(chave_repositorio.itens) == 1


async def test_falha_explicita_sem_chave_cadastrada(vault: FakeVaultClient) -> None:
    gerenciador = GerenciadorChaves(FakeChaveJwtRepositorio(), vault, cache=CacheChavesPrivadas())

    with pytest.raises(ChaveDeAssinaturaIndisponivelError):
        await gerenciador.obter_chave_de_assinatura()


async def test_falha_explicita_quando_a_privada_some_do_vault(
    chave_repositorio: FakeChaveJwtRepositorio,
    vault: FakeVaultClient,
) -> None:
    gerenciador = GerenciadorChaves(chave_repositorio, vault, cache=CacheChavesPrivadas())
    chave = await gerenciador.garantir_chave_ativa()
    await vault.remover_segredo(caminho_chave_privada(chave.kid))

    outro_gerenciador = GerenciadorChaves(chave_repositorio, vault, cache=CacheChavesPrivadas())
    with pytest.raises(ChaveDeAssinaturaIndisponivelError):
        await outro_gerenciador.obter_chave_de_assinatura()


async def test_chave_desconhecida_nao_valida_token(gerenciador_chaves: GerenciadorChaves) -> None:
    servico = ServicoJwt(gerenciador_chaves, issuer=ISSUER_DE_TESTE, audience=AUDIENCE_DE_TESTE)
    assert await gerenciador_chaves.obter_chave_publica("kid-que-nao-existe") is None

    emitido = await servico.emitir(sub="svc", tipo=TipoToken.SERVICE)
    assert await gerenciador_chaves.obter_chave_publica(emitido.kid) is not None
