"""Prepara o ambiente de desenvolvimento.

Cria (de forma idempotente):

1. o primeiro par de chaves JWT — privada no Vault, pública em ``chaves_jwt``;
2. o cliente compartilhado das RPAs (``app_rpa``);
3. a RPA ``rpa_custeio``, com credenciais de exemplo no Vault;
4. um microsserviço de exemplo (``svc_exemplo``).

Os ``client_secret`` gerados são impressos **uma única vez**.

    uv run python scripts/bootstrap.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sqlalchemy.ext.asyncio import async_sessionmaker  # noqa: E402
from sqlmodel.ext.asyncio.session import AsyncSession  # noqa: E402

from app.config import obter_settings  # noqa: E402
from app.database.session import criar_engine  # noqa: E402
from app.models.enums import TipoCliente  # noqa: E402
from app.repositories.chave_jwt_repository import ChaveJwtRepositorioSQL  # noqa: E402
from app.repositories.cliente_repository import ClienteRepositorioSQL  # noqa: E402
from app.repositories.rpa_repository import RpaRepositorioSQL  # noqa: E402
from app.schemas.cliente import ClienteCriacaoRequest  # noqa: E402
from app.schemas.rpa import RpaCriacaoRequest  # noqa: E402
from app.security.admin_auth import IdentidadeAdmin  # noqa: E402
from app.security.key_manager import CacheChavesPrivadas, GerenciadorChaves  # noqa: E402
from app.services.cliente_service import ServicoCliente  # noqa: E402
from app.services.rpa_service import ServicoRpa  # noqa: E402
from app.vault.http_client import VaultHttpClient  # noqa: E402

ADMIN_BOOTSTRAP = IdentidadeAdmin(identificador="bootstrap", origem="script")

CLIENTE_RPA = ClienteCriacaoRequest(
    client_id="app_rpa",
    nome="Aplicação compartilhada das RPAs",
    descricao="Credencial usada por todas as RPAs, junto com o rpa_id",
    tipo=TipoCliente.RPA,
)
CLIENTE_SERVICO = ClienteCriacaoRequest(
    client_id="svc_exemplo",
    nome="Microsserviço de exemplo",
    descricao="Cliente de demonstração para o fluxo client_credentials",
    tipo=TipoCliente.SERVICO,
)
RPA_CUSTEIO = RpaCriacaoRequest(
    rpa_id="rpa_custeio",
    nome="RPA de Custeio",
    descricao="RPA de exemplo criada pelo bootstrap",
    credenciais={"usuario": "rpa.custeio", "senha": "trocar-em-producao"},
)


async def main() -> None:
    settings = obter_settings()
    engine = criar_engine(settings.database_url)
    criador_de_sessao = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    vault = VaultHttpClient(
        endereco=settings.vault_addr,
        token=settings.vault_token,
        mount=settings.vault_kv_mount,
        prefixo=settings.prefixo_vault,
    )

    if not await vault.verificar_saude():
        print("Vault indisponível em", settings.vault_addr)
        raise SystemExit(1)

    async with criador_de_sessao() as sessao:
        chave_repositorio = ChaveJwtRepositorioSQL(sessao)
        gerenciador = GerenciadorChaves(
            chave_repositorio,
            vault,
            minutos_de_graca=settings.key_rotation_grace_minutes,
            cache=CacheChavesPrivadas(),
        )
        chave = await gerenciador.garantir_chave_ativa()
        await sessao.commit()
        print(f"Chave de assinatura ativa: kid={chave.kid}")

        servico_cliente = ServicoCliente(ClienteRepositorioSQL(sessao))
        for dados in (CLIENTE_RPA, CLIENTE_SERVICO):
            existente = await servico_cliente.buscar(dados.client_id or "")
            if existente is not None:
                print(f"Cliente {existente.client_id} já existe — secret preservado")
                continue
            cliente, secret = await servico_cliente.criar(dados, ADMIN_BOOTSTRAP)
            print(f"Cliente criado: {cliente.client_id}")
            print(f"  client_secret: {secret}")

        servico_rpa = ServicoRpa(RpaRepositorioSQL(sessao), vault)
        if await servico_rpa.buscar(RPA_CUSTEIO.rpa_id) is None:
            rpa = await servico_rpa.criar(RPA_CUSTEIO, ADMIN_BOOTSTRAP)
            print(f"RPA criada e autorizada no Vault: {rpa.rpa_id}")
        else:
            print(f"RPA {RPA_CUSTEIO.rpa_id} já existe")

    await vault.fechar()
    await engine.dispose()
    print("\nGuarde os secrets acima: eles não podem ser consultados novamente.")


if __name__ == "__main__":
    asyncio.run(main())
