"""Emissão de token para microsserviços (OAuth2 Client Credentials)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Form, status

from app.dependencies import ServicoTokenDep
from app.schemas.token import CredenciaisClienteForm, ErroOAuthResposta, TokenResposta
from app.security.dependencias import CredenciaisBasic, resolver_credenciais_cliente

router = APIRouter(prefix="/oauth", tags=["Tokens"])


@router.post(
    "/service/token",
    response_model=TokenResposta,
    summary="Emite um access token para um microsserviço",
    description=(
        "OAuth2 Client Credentials. As credenciais podem vir no corpo do formulário "
        "ou no cabeçalho `Authorization: Basic`."
    ),
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErroOAuthResposta,
            "description": "Credenciais inválidas",
        },
        status.HTTP_403_FORBIDDEN: {"model": ErroOAuthResposta, "description": "Cliente bloqueado"},
    },
)
async def emitir_token_servico(
    formulario: Annotated[CredenciaisClienteForm, Form()],
    basic: CredenciaisBasic,
    servico: ServicoTokenDep,
) -> TokenResposta:
    client_id, client_secret = resolver_credenciais_cliente(
        basic, formulario.client_id, formulario.client_secret
    )
    token = await servico.emitir_para_servico(client_id, client_secret)
    return TokenResposta(
        access_token=token.access_token,
        token_type=token.token_type,
        expires_in=token.expires_in,
    )
