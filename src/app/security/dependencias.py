"""Dependências de autenticação usadas pelos routers."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBasic,
    HTTPBasicCredentials,
    HTTPBearer,
)

from app.dependencies import AutenticadorAdminDep, ServicoJwtDep
from app.observability import auditoria
from app.security.admin_auth import CredencialAdminInvalidaError, IdentidadeAdmin
from app.security.jwt_service import ClaimsToken, TokenInvalidoError
from app.services.erros import CredenciaisInvalidasError

esquema_bearer = HTTPBearer(auto_error=False, scheme_name="Bearer")
esquema_basic = HTTPBasic(auto_error=False, scheme_name="ClientCredentialsBasic")

CredenciaisBearer = Annotated[
    HTTPAuthorizationCredentials | None,
    Depends(esquema_bearer),
]
CredenciaisBasic = Annotated[
    HTTPBasicCredentials | None,
    Depends(esquema_basic),
]


def resolver_credenciais_cliente(
    basic: HTTPBasicCredentials | None,
    client_id: str | None,
    client_secret: str | None,
) -> tuple[str, str]:
    """Extrai ``client_id``/``client_secret`` do cabeçalho Basic ou do formulário.

    A RFC 6749 prevê as duas formas; o cabeçalho tem precedência quando presente.
    """
    if basic is not None:
        return basic.username, basic.password
    if client_id and client_secret:
        return client_id, client_secret
    raise CredenciaisInvalidasError("Credenciais de cliente não informadas")


async def requer_admin(
    credenciais: CredenciaisBearer,
    autenticador: AutenticadorAdminDep,
) -> IdentidadeAdmin:
    """Exige credencial administrativa válida no cabeçalho ``Authorization``."""
    token = credenciais.credentials if credenciais else None
    try:
        identidade = await autenticador.autenticar(token)
    except CredencialAdminInvalidaError:
        auditoria.registrar_falha(
            auditoria.AUTENTICACAO_FALHA,
            "Credencial administrativa recusada",
            origem=getattr(autenticador, "origem", "desconhecida"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credencial administrativa inválida",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except NotImplementedError as erro:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(erro),
        ) from erro

    return identidade


AdminDep = Annotated[IdentidadeAdmin, Depends(requer_admin)]


async def obter_claims_do_token(
    credenciais: CredenciaisBearer,
    servico_jwt: ServicoJwtDep,
) -> ClaimsToken:
    """Valida o access token do próprio serviço e devolve os claims."""
    if credenciais is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso não informado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return await servico_jwt.validar(credenciais.credentials)
    except TokenInvalidoError as erro:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(erro),
            headers={"WWW-Authenticate": "Bearer"},
        ) from erro


ClaimsTokenDep = Annotated[ClaimsToken, Depends(obter_claims_do_token)]
