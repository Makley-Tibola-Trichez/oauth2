"""Autenticação administrativa — ponto de troca para o Microsoft Entra ID.

Os routers e services dependem apenas do protocolo ``AutenticadorAdmin`` e da
``IdentidadeAdmin`` devolvida por ele. Trocar o token estático pelo Entra ID é
substituir a implementação registrada na factory: nenhuma regra de negócio muda.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from app.config import Settings

ORIGEM_ESTATICA = "static"
ORIGEM_ENTRA_ID = "entraid"


class CredencialAdminInvalidaError(Exception):
    """Credencial administrativa ausente, malformada ou não reconhecida."""


@dataclass(frozen=True, slots=True)
class IdentidadeAdmin:
    """Quem executou a operação administrativa — vai para o log de auditoria."""

    identificador: str
    origem: str
    nome: str | None = None


@runtime_checkable
class AutenticadorAdmin(Protocol):
    origem: str

    async def autenticar(self, credencial: str | None) -> IdentidadeAdmin:
        """Valida a credencial ou levanta ``CredencialAdminInvalidaError``."""
        ...


class AutenticadorAdminTokenEstatico:
    """Implementação **temporária**, apenas para desenvolvimento e testes.

    Compara a credencial com o ``ADMIN_TOKEN`` do ambiente em tempo constante.
    Não há identidade real: todos os administradores compartilham o mesmo token.
    """

    origem = ORIGEM_ESTATICA

    def __init__(self, token_esperado: str, identificador: str = "administrador-local") -> None:
        if not token_esperado:
            raise ValueError("Token administrativo não configurado")
        self._token_esperado = token_esperado
        self._identificador = identificador

    async def autenticar(self, credencial: str | None) -> IdentidadeAdmin:
        if not credencial or not secrets.compare_digest(credencial, self._token_esperado):
            raise CredencialAdminInvalidaError("Credencial administrativa inválida")
        return IdentidadeAdmin(identificador=self._identificador, origem=self.origem)


class AutenticadorAdminEntraId:
    """Implementação definitiva com Microsoft Entra ID — ainda não habilitada.

    O contrato já está no lugar; o que falta é o miolo da validação:

    1. baixar e cachear o JWKS do tenant em
       ``https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys``;
    2. validar o JWT recebido (assinatura RS256, ``iss`` do tenant, ``aud``
       igual ao ``ENTRA_CLIENT_ID``, ``exp``/``nbf``);
    3. exigir a role/app role administrativa nos claims (``roles`` ou ``scp``);
    4. devolver ``IdentidadeAdmin`` com ``oid``/``appid`` e ``name``.

    Enquanto isso não for homologado contra um tenant real, a classe falha de
    forma explícita em vez de aceitar credenciais sem verificação.
    """

    origem = ORIGEM_ENTRA_ID

    def __init__(self, tenant_id: str, client_id: str) -> None:
        self.tenant_id = tenant_id
        self.client_id = client_id

    @property
    def url_jwks(self) -> str:
        return f"https://login.microsoftonline.com/{self.tenant_id}/discovery/v2.0/keys"

    @property
    def issuer_esperado(self) -> str:
        return f"https://login.microsoftonline.com/{self.tenant_id}/v2.0"

    async def autenticar(self, credencial: str | None) -> IdentidadeAdmin:
        raise NotImplementedError(
            "Autenticação administrativa via Entra ID ainda não implementada; "
            "use ADMIN_AUTH_MODE=static até a homologação"
        )


def criar_autenticador_admin(settings: Settings) -> AutenticadorAdmin:
    """Escolhe a implementação conforme ``ADMIN_AUTH_MODE``."""
    if settings.admin_auth_mode == ORIGEM_ENTRA_ID:
        return AutenticadorAdminEntraId(
            tenant_id=settings.entra_tenant_id or "",
            client_id=settings.entra_client_id or "",
        )
    return AutenticadorAdminTokenEstatico(settings.admin_token or "")
