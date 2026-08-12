"""Contratos dos endpoints de emissão de token (OAuth2 Client Credentials)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.cliente import PADRAO_IDENTIFICADOR

GRANT_TYPE_SUPORTADO = "client_credentials"


class CredenciaisClienteForm(BaseModel):
    """Corpo ``application/x-www-form-urlencoded`` do Client Credentials.

    ``client_id`` e ``client_secret`` podem vir aqui ou no cabeçalho
    ``Authorization: Basic``, como prevê a RFC 6749.
    """

    grant_type: Literal["client_credentials"] = Field(default=GRANT_TYPE_SUPORTADO)
    client_id: str | None = None
    client_secret: str | None = None


class CredenciaisRpaForm(CredenciaisClienteForm):
    rpa_id: str = Field(
        pattern=PADRAO_IDENTIFICADOR,
        description=(
            "RPA que está executando. Não é confiado por vir na requisição: "
            "o serviço confirma a autorização no Vault antes de emitir o token."
        ),
        examples=["rpa_custeio"],
    )


class TokenResposta(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int = Field(description="Validade do token em segundos")


class ErroOAuthResposta(BaseModel):
    error: str = Field(examples=["invalid_client"])
    error_description: str
