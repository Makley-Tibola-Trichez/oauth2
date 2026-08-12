"""Rotaciona a chave de assinatura dos JWTs.

Gera um novo par, grava a privada no Vault e promove a nova chave a ativa. A
anterior fica ``em_rotacao`` e continua publicada no JWKS pelo período de graça
(``KEY_ROTATION_GRACE_MINUTES``), para que os tokens já emitidos continuem
válidos até expirarem.

    uv run python scripts/rotacionar_chave.py
    uv run python scripts/rotacionar_chave.py --aposentar
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from sqlalchemy.ext.asyncio import async_sessionmaker  # noqa: E402
from sqlmodel.ext.asyncio.session import AsyncSession  # noqa: E402

from app.config import obter_settings  # noqa: E402
from app.database.session import criar_engine  # noqa: E402
from app.repositories.chave_jwt_repository import ChaveJwtRepositorioSQL  # noqa: E402
from app.security.key_manager import CacheChavesPrivadas, GerenciadorChaves  # noqa: E402
from app.vault.http_client import VaultHttpClient  # noqa: E402


async def main(aposentar: bool) -> None:
    settings = obter_settings()
    engine = criar_engine(settings.database_url)
    criador_de_sessao = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    vault = VaultHttpClient(
        endereco=settings.vault_addr,
        token=settings.vault_token,
        mount=settings.vault_kv_mount,
        prefixo=settings.prefixo_vault,
    )

    async with criador_de_sessao() as sessao:
        gerenciador = GerenciadorChaves(
            ChaveJwtRepositorioSQL(sessao),
            vault,
            minutos_de_graca=settings.key_rotation_grace_minutes,
            cache=CacheChavesPrivadas(),
        )

        if aposentar:
            kids = await gerenciador.aposentar_chaves_expiradas()
            await sessao.commit()
            print(f"Chaves aposentadas: {kids or 'nenhuma'}")
            return

        nova = await gerenciador.rotacionar()
        await sessao.commit()
        print(f"Nova chave ativa: kid={nova.kid}")
        print(
            "A chave anterior permanece no JWKS por "
            f"{settings.key_rotation_grace_minutes} minutos."
        )

    await vault.fechar()
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--aposentar",
        action="store_true",
        help="Em vez de rotacionar, remove do JWKS as chaves cujo período de graça terminou",
    )
    asyncio.run(main(parser.parse_args().aposentar))
