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
from app.security.admin_auth import AutenticadorAdmin, criar_autenticador_admin
from app.security.jwt_service import ServicoJwt
from app.security.key_manager import GerenciadorChaves
from app.services.cliente_service import ServicoCliente
from app.services.introspeccao_service import ServicoIntrospeccao
from app.services.rpa_service import ServicoRpa
from app.services.token_service import ServicoToken
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


def obter_servico_jwt(
    gerenciador_chaves: GerenciadorChavesDep,
    settings: SettingsDep,
) -> ServicoJwt:
    return ServicoJwt(
        gerenciador_chaves,
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
        expiracao_minutos=settings.access_token_expire_minutes,
    )


ServicoJwtDep = Annotated[ServicoJwt, Depends(obter_servico_jwt)]


@lru_cache(maxsize=1)
def obter_autenticador_admin() -> AutenticadorAdmin:
    """Implementação de autenticação administrativa em uso (estática ou Entra ID)."""
    return criar_autenticador_admin(obter_settings())


AutenticadorAdminDep = Annotated[AutenticadorAdmin, Depends(obter_autenticador_admin)]


def obter_servico_token(
    cliente_repositorio: ClienteRepositorioDep,
    rpa_repositorio: RpaRepositorioDep,
    vault: VaultDep,
    servico_jwt: ServicoJwtDep,
) -> ServicoToken:
    return ServicoToken(cliente_repositorio, rpa_repositorio, vault, servico_jwt)


def obter_servico_cliente(cliente_repositorio: ClienteRepositorioDep) -> ServicoCliente:
    return ServicoCliente(cliente_repositorio)


def obter_servico_rpa(rpa_repositorio: RpaRepositorioDep, vault: VaultDep) -> ServicoRpa:
    return ServicoRpa(rpa_repositorio, vault)


def obter_servico_introspeccao(
    servico_jwt: ServicoJwtDep,
    cliente_repositorio: ClienteRepositorioDep,
    rpa_repositorio: RpaRepositorioDep,
) -> ServicoIntrospeccao:
    return ServicoIntrospeccao(servico_jwt, cliente_repositorio, rpa_repositorio)


ServicoTokenDep = Annotated[ServicoToken, Depends(obter_servico_token)]
ServicoClienteDep = Annotated[ServicoCliente, Depends(obter_servico_cliente)]
ServicoRpaDep = Annotated[ServicoRpa, Depends(obter_servico_rpa)]
ServicoIntrospeccaoDep = Annotated[ServicoIntrospeccao, Depends(obter_servico_introspeccao)]
