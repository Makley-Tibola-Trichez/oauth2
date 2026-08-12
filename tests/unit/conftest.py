"""Fixtures dos testes unitários — nada aqui toca PostgreSQL ou Vault real."""

from __future__ import annotations

import pytest

from app.models.cliente import Cliente
from app.models.enums import StatusAcesso, TipoCliente
from app.models.rpa import Rpa
from app.security.gerador_secret import gerar_client_secret
from app.security.hashing import HasherSecret
from app.security.jwt_service import ServicoJwt
from app.security.key_manager import CacheChavesPrivadas, GerenciadorChaves
from app.services.token_service import ServicoToken
from app.vault.caminhos import caminho_rpa
from app.vault.fake_client import FakeVaultClient
from tests.conftest import AUDIENCE_DE_TESTE, ISSUER_DE_TESTE
from tests.fakes import FakeChaveJwtRepositorio, FakeClienteRepositorio, FakeRpaRepositorio

SECRET_RPA = "secret-da-aplicacao-rpa"
SECRET_SERVICO = "secret-do-microsservico"


@pytest.fixture
def hasher() -> HasherSecret:
    return HasherSecret()


@pytest.fixture
def cliente_rpa(hasher: HasherSecret) -> Cliente:
    return Cliente(
        client_id="app_rpa",
        client_secret_hash=hasher.gerar_hash(SECRET_RPA),
        nome="Aplicação das RPAs",
        tipo=TipoCliente.RPA,
        status=StatusAcesso.ATIVO,
    )


@pytest.fixture
def cliente_servico(hasher: HasherSecret) -> Cliente:
    return Cliente(
        client_id="svc_faturamento",
        client_secret_hash=hasher.gerar_hash(SECRET_SERVICO),
        nome="Serviço de Faturamento",
        tipo=TipoCliente.SERVICO,
        status=StatusAcesso.ATIVO,
    )


@pytest.fixture
def rpa_custeio() -> Rpa:
    return Rpa(rpa_id="rpa_custeio", nome="RPA de Custeio", status=StatusAcesso.ATIVO)


@pytest.fixture
def vault(rpa_custeio: Rpa) -> FakeVaultClient:
    """Vault já com a autorização da ``rpa_custeio``."""
    return FakeVaultClient(
        {caminho_rpa(rpa_custeio.rpa_id): {"credenciais": {"usuario": "rpa.custeio"}}}
    )


@pytest.fixture
def chave_repositorio() -> FakeChaveJwtRepositorio:
    return FakeChaveJwtRepositorio()


@pytest.fixture
async def gerenciador_chaves(
    chave_repositorio: FakeChaveJwtRepositorio,
    vault: FakeVaultClient,
) -> GerenciadorChaves:
    gerenciador = GerenciadorChaves(chave_repositorio, vault, cache=CacheChavesPrivadas())
    await gerenciador.garantir_chave_ativa()
    return gerenciador


@pytest.fixture
def servico_jwt(gerenciador_chaves: GerenciadorChaves) -> ServicoJwt:
    return ServicoJwt(
        gerenciador_chaves,
        issuer=ISSUER_DE_TESTE,
        audience=AUDIENCE_DE_TESTE,
        expiracao_minutos=30,
    )


@pytest.fixture
def cliente_repositorio(
    cliente_rpa: Cliente,
    cliente_servico: Cliente,
) -> FakeClienteRepositorio:
    return FakeClienteRepositorio([cliente_rpa, cliente_servico])


@pytest.fixture
def rpa_repositorio(rpa_custeio: Rpa) -> FakeRpaRepositorio:
    return FakeRpaRepositorio([rpa_custeio])


@pytest.fixture
def servico_token(
    cliente_repositorio: FakeClienteRepositorio,
    rpa_repositorio: FakeRpaRepositorio,
    vault: FakeVaultClient,
    servico_jwt: ServicoJwt,
    hasher: HasherSecret,
) -> ServicoToken:
    return ServicoToken(
        cliente_repositorio,
        rpa_repositorio,
        vault,
        servico_jwt,
        hasher=hasher,
    )


@pytest.fixture
def secret_aleatorio() -> str:
    return gerar_client_secret()
