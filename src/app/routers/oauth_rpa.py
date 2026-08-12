"""Emissão de token para RPAs."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Form, status

from app.dependencies import ServicoTokenDep
from app.schemas.token import CredenciaisRpaForm, ErroOAuthResposta, TokenResposta
from app.security.dependencias import CredenciaisBasic, resolver_credenciais_cliente

router = APIRouter(prefix="/oauth", tags=["Tokens"])


@router.post(
    "/rpa/token",
    response_model=TokenResposta,
    summary="Emite um access token para uma RPA",
    description=(
        "OAuth2 Client Credentials com o parâmetro adicional `rpa_id`.\n\n"
        "A validação acontece nesta ordem: `client_id` + `client_secret` contra o "
        "PostgreSQL, depois a autorização do `rpa_id` no Vault e o status da RPA no "
        "cadastro. O `rpa_id` recebido só vira claim depois de confirmado."
    ),
    responses={
        status.HTTP_400_BAD_REQUEST: {
            "model": ErroOAuthResposta,
            "description": "rpa_id não autorizado",
        },
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErroOAuthResposta,
            "description": "Credenciais inválidas",
        },
        status.HTTP_403_FORBIDDEN: {
            "model": ErroOAuthResposta,
            "description": "Cliente ou RPA bloqueado",
        },
    },
)
async def emitir_token_rpa(
    formulario: Annotated[CredenciaisRpaForm, Form()],
    basic: CredenciaisBasic,
    servico: ServicoTokenDep,
) -> TokenResposta:
    client_id, client_secret = resolver_credenciais_cliente(
        basic, formulario.client_id, formulario.client_secret
    )
    token = await servico.emitir_para_rpa(client_id, client_secret, formulario.rpa_id)
    return TokenResposta(
        access_token=token.access_token,
        token_type=token.token_type,
        expires_in=token.expires_in,
    )
