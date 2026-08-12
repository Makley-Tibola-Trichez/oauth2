"""Criação, rotação de secret e revogação de clientes."""

from __future__ import annotations

import pytest

from app.models.enums import StatusAcesso, TipoCliente
from app.schemas.cliente import ClienteCriacaoRequest
from app.security.admin_auth import IdentidadeAdmin
from app.security.hashing import HasherSecret
from app.services.cliente_service import ServicoCliente
from app.services.erros import RecursoDuplicadoError, RecursoNaoEncontradoError
from app.services.token_service import ServicoToken
from tests.fakes import FakeClienteRepositorio
from tests.unit.conftest import SECRET_SERVICO

ADMIN = IdentidadeAdmin(identificador="admin-de-teste", origem="static")


@pytest.fixture
def servico_cliente(
    cliente_repositorio: FakeClienteRepositorio,
    hasher: HasherSecret,
) -> ServicoCliente:
    return ServicoCliente(cliente_repositorio, hasher=hasher)


async def test_cria_cliente_guardando_apenas_o_hash(
    servico_cliente: ServicoCliente,
    hasher: HasherSecret,
) -> None:
    dados = ClienteCriacaoRequest(
        client_id="svc_novo", nome="Serviço Novo", tipo=TipoCliente.SERVICO
    )

    cliente, secret = await servico_cliente.criar(dados, ADMIN)

    assert cliente.client_id == "svc_novo"
    assert StatusAcesso(cliente.status) is StatusAcesso.ATIVO
    assert cliente.client_secret_hash != secret
    assert hasher.verificar(secret, cliente.client_secret_hash)


async def test_gera_client_id_quando_omitido(servico_cliente: ServicoCliente) -> None:
    dados = ClienteCriacaoRequest(nome="Serviço Sem Id", tipo=TipoCliente.SERVICO)

    cliente, _ = await servico_cliente.criar(dados, ADMIN)

    assert cliente.client_id.startswith("servico_")


async def test_recusa_client_id_duplicado(servico_cliente: ServicoCliente) -> None:
    dados = ClienteCriacaoRequest(client_id="app_rpa", nome="Duplicado", tipo=TipoCliente.RPA)

    with pytest.raises(RecursoDuplicadoError):
        await servico_cliente.criar(dados, ADMIN)


async def test_obter_cliente_inexistente(servico_cliente: ServicoCliente) -> None:
    with pytest.raises(RecursoNaoEncontradoError):
        await servico_cliente.obter("nao_existe")

    assert await servico_cliente.buscar("nao_existe") is None


async def test_rotacao_invalida_o_secret_anterior(
    servico_cliente: ServicoCliente,
    servico_token: ServicoToken,
) -> None:
    cliente, novo_secret = await servico_cliente.rotacionar_secret("svc_faturamento", ADMIN)

    assert cliente.secret_rotacionado_em is not None
    assert novo_secret != SECRET_SERVICO

    from app.services.erros import CredenciaisInvalidasError

    with pytest.raises(CredenciaisInvalidasError):
        await servico_token.emitir_para_servico("svc_faturamento", SECRET_SERVICO)

    token = await servico_token.emitir_para_servico("svc_faturamento", novo_secret)
    assert token.access_token


async def test_rotacoes_seguidas_geram_secrets_diferentes(
    servico_cliente: ServicoCliente,
) -> None:
    _, primeiro = await servico_cliente.rotacionar_secret("svc_faturamento", ADMIN)
    _, segundo = await servico_cliente.rotacionar_secret("svc_faturamento", ADMIN)

    assert primeiro != segundo


async def test_revogacao_bloqueia_novos_tokens(
    servico_cliente: ServicoCliente,
    servico_token: ServicoToken,
) -> None:
    cliente = await servico_cliente.revogar("svc_faturamento", ADMIN)

    assert StatusAcesso(cliente.status) is StatusAcesso.REVOGADO
    assert cliente.revogado_em is not None

    from app.services.erros import AcessoBloqueadoError

    with pytest.raises(AcessoBloqueadoError):
        await servico_token.emitir_para_servico("svc_faturamento", SECRET_SERVICO)


async def test_revogacao_e_idempotente(servico_cliente: ServicoCliente) -> None:
    primeira = await servico_cliente.revogar("svc_faturamento", ADMIN)
    segunda = await servico_cliente.revogar("svc_faturamento", ADMIN)

    assert primeira.revogado_em == segunda.revogado_em


async def test_escritas_sao_confirmadas(
    servico_cliente: ServicoCliente,
    cliente_repositorio: FakeClienteRepositorio,
) -> None:
    await servico_cliente.criar(
        ClienteCriacaoRequest(client_id="svc_commit", nome="Commit", tipo=TipoCliente.SERVICO),
        ADMIN,
    )

    assert cliente_repositorio.confirmacoes == 1
