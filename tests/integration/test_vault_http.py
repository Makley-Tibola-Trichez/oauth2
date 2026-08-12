"""Integração real com o HashiCorp Vault do docker compose.

Pulado automaticamente quando o Vault não está no ar.
"""

from __future__ import annotations

import os
import uuid

import pytest

from app.vault.erros import VaultPermissaoError
from app.vault.http_client import VaultHttpClient

pytestmark = pytest.mark.integracao


def criar_cliente(token: str | None = None) -> VaultHttpClient:
    return VaultHttpClient(
        endereco=os.environ["VAULT_ADDR"],
        token=token or os.environ["VAULT_TOKEN"],
        mount=os.getenv("VAULT_KV_MOUNT", "secret"),
        prefixo=f"oauth-testes/{uuid.uuid4().hex[:8]}",
    )


@pytest.fixture
async def vault_real():
    cliente = criar_cliente()
    if not await cliente.verificar_saude():
        await cliente.fechar()
        pytest.skip("Vault indisponível — suba o ambiente com `docker compose up -d`")
    yield cliente
    await cliente.fechar()


async def test_ciclo_de_vida_de_um_segredo(vault_real: VaultHttpClient) -> None:
    caminho = "rpa/rpa_de_teste"

    assert await vault_real.ler_segredo(caminho) is None
    assert await vault_real.existe(caminho) is False

    await vault_real.gravar_segredo(caminho, {"credenciais": {"usuario": "u"}})

    assert await vault_real.existe(caminho) is True
    assert (await vault_real.ler_segredo(caminho))["credenciais"] == {"usuario": "u"}

    await vault_real.gravar_segredo(caminho, {"credenciais": {"usuario": "outro"}})
    assert (await vault_real.ler_segredo(caminho))["credenciais"] == {"usuario": "outro"}

    await vault_real.remover_segredo(caminho)
    assert await vault_real.existe(caminho) is False

    # remover algo inexistente não pode explodir
    await vault_real.remover_segredo(caminho)


async def test_token_invalido_e_recusado(vault_real: VaultHttpClient) -> None:
    intruso = criar_cliente(token="token-invalido")
    try:
        with pytest.raises(VaultPermissaoError):
            await intruso.gravar_segredo("rpa/qualquer", {"x": 1})
    finally:
        await intruso.fechar()
