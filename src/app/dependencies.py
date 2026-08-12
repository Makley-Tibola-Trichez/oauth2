"""Injeção de dependências compartilhada pelos routers."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import Settings, obter_settings
from app.database import obter_sessao
from app.repositories.chave_jwt_repository import ChaveJwtRepositorioSQL
from app.repositories.cliente_repository import ClienteRepositorioSQL
from app.repositories.rpa_repository import RpaRepositorioSQL
from app.security.key_manager import GerenciadorChaves
from app.vault.client import VaultClient
from app.vault.http_client import VaultHttpClient

SessaoDep = Annotated[AsyncSession, Depends(obter_sessao)]
SettingsDep = Annotated[Settings, Depends(obter_settings)]


@lru_cache(maxsize=1)
def obter_vault() -> VaultClient:
    """Cliente do Vault reaproveitado entre requisições (mantém o pool HTTP).

    Nos testes, sobrescreva esta dependência com o ``FakeVaultClient``.
    """
    settings = obter_settings()
    return VaultHttpClient(
        endereco=settings.vault_addr,
        token=settings.vault_token,
        mount=settings.vault_kv_mount,
        prefixo=settings.prefixo_vault,
    )


VaultDep = Annotated[VaultClient, Depends(obter_vault)]


def obter_cliente_repositorio(sessao: SessaoDep) -> ClienteRepositorioSQL:
    return ClienteRepositorioSQL(sessao)


def obter_rpa_repositorio(sessao: SessaoDep) -> RpaRepositorioSQL:
    return RpaRepositorioSQL(sessao)


def obter_chave_repositorio(sessao: SessaoDep) -> ChaveJwtRepositorioSQL:
    return ChaveJwtRepositorioSQL(sessao)


ClienteRepositorioDep = Annotated[ClienteRepositorioSQL, Depends(obter_cliente_repositorio)]
RpaRepositorioDep = Annotated[RpaRepositorioSQL, Depends(obter_rpa_repositorio)]
ChaveRepositorioDep = Annotated[ChaveJwtRepositorioSQL, Depends(obter_chave_repositorio)]


def obter_gerenciador_chaves(
    chave_repositorio: ChaveRepositorioDep,
    vault: VaultDep,
    settings: SettingsDep,
) -> GerenciadorChaves:
    return GerenciadorChaves(
        chave_repositorio,
        vault,
        minutos_de_graca=settings.key_rotation_grace_minutes,
    )


GerenciadorChavesDep = Annotated[GerenciadorChaves, Depends(obter_gerenciador_chaves)]
