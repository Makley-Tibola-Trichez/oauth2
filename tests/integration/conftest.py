"""Fixtures dos testes de integração.

Usam o PostgreSQL de teste disponibilizado pelo docker compose (banco
``oauth_test``), com o schema criado pelas migrations do Alembic. O Vault é
substituído pelo fake para manter os testes determinísticos — a integração
real com o Vault é exercitada em ``test_vault_http.py``.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

import httpx
import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database.session import criar_engine
from app.dependencies import obter_autenticador_admin, obter_sessao, obter_vault
from app.main import app as aplicacao
from app.models.enums import TipoCliente
from app.repositories.chave_jwt_repository import ChaveJwtRepositorioSQL
from app.repositories.cliente_repository import ClienteRepositorioSQL
from app.schemas.cliente import ClienteCriacaoRequest
from app.schemas.rpa import RpaCriacaoRequest
from app.security.admin_auth import AutenticadorAdminTokenEstatico, IdentidadeAdmin
from app.security.key_manager import CacheChavesPrivadas, GerenciadorChaves
from app.services.cliente_service import ServicoCliente
from app.services.rpa_service import ServicoRpa
from app.vault.fake_client import FakeVaultClient
from tests.conftest import TOKEN_ADMIN_DE_TESTE, URL_BANCO_DE_TESTE

RAIZ_DO_PROJETO = Path(__file__).resolve().parents[2]
TABELAS = ("clientes", "rpas", "chaves_jwt")

ADMIN_DE_TESTE = IdentidadeAdmin(identificador="admin-de-teste", origem="static")
CABECALHO_ADMIN = {"Authorization": f"Bearer {TOKEN_ADMIN_DE_TESTE}"}


@pytest.fixture(scope="session", autouse=True)
def migracoes() -> Iterator[None]:
    """Aplica as migrations no banco de teste antes da suíte."""
    os.environ["ALEMBIC_DATABASE_URL"] = URL_BANCO_DE_TESTE
    configuracao = Config(str(RAIZ_DO_PROJETO / "alembic.ini"))
    command.upgrade(configuracao, "head")
    yield


@pytest.fixture
async def sessao(migracoes: None) -> AsyncIterator[AsyncSession]:
    engine = criar_engine(URL_BANCO_DE_TESTE)
    criador = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with criador() as sessao:
        conexao = await sessao.connection()
        await conexao.execute(text(f"TRUNCATE {', '.join(TABELAS)} CASCADE"))
        await sessao.commit()
        yield sessao

    await engine.dispose()


@pytest.fixture
def vault() -> FakeVaultClient:
    return FakeVaultClient()


@pytest.fixture
async def chave_ativa(sessao: AsyncSession, vault: FakeVaultClient) -> str:
    """Garante uma chave de assinatura antes de qualquer emissão de token."""
    gerenciador = GerenciadorChaves(
        ChaveJwtRepositorioSQL(sessao), vault, cache=CacheChavesPrivadas()
    )
    chave = await gerenciador.garantir_chave_ativa()
    await sessao.commit()
    return chave.kid


@pytest.fixture
async def cliente_http(
    sessao: AsyncSession,
    vault: FakeVaultClient,
    chave_ativa: str,
) -> AsyncIterator[httpx.AsyncClient]:
    aplicacao.dependency_overrides[obter_sessao] = lambda: sessao
    aplicacao.dependency_overrides[obter_vault] = lambda: vault
    aplicacao.dependency_overrides[obter_autenticador_admin] = lambda: (
        AutenticadorAdminTokenEstatico(TOKEN_ADMIN_DE_TESTE)
    )

    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=aplicacao),
        base_url="http://testes",
    ) as cliente:
        yield cliente

    aplicacao.dependency_overrides.clear()


@pytest.fixture
async def credenciais_rpa(sessao: AsyncSession, vault: FakeVaultClient) -> tuple[str, str]:
    """Cliente compartilhado das RPAs e a ``rpa_custeio`` já autorizada."""
    servico = ServicoCliente(ClienteRepositorioSQL(sessao))
    cliente, secret = await servico.criar(
        ClienteCriacaoRequest(client_id="app_rpa", nome="Aplicação das RPAs", tipo=TipoCliente.RPA),
        ADMIN_DE_TESTE,
    )

    from app.repositories.rpa_repository import RpaRepositorioSQL

    await ServicoRpa(RpaRepositorioSQL(sessao), vault).criar(
        RpaCriacaoRequest(
            rpa_id="rpa_custeio",
            nome="RPA de Custeio",
            credenciais={"usuario": "rpa.custeio", "senha": "segredo-do-vault"},
        ),
        ADMIN_DE_TESTE,
    )
    return cliente.client_id, secret


@pytest.fixture
async def credenciais_servico(sessao: AsyncSession) -> tuple[str, str]:
    servico = ServicoCliente(ClienteRepositorioSQL(sessao))
    cliente, secret = await servico.criar(
        ClienteCriacaoRequest(
            client_id="svc_faturamento",
            nome="Serviço de Faturamento",
            tipo=TipoCliente.SERVICO,
        ),
        ADMIN_DE_TESTE,
    )
    return cliente.client_id, secret
