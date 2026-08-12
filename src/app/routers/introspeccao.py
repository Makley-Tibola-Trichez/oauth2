"""Introspection de tokens (RFC 7662)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Form

from app.dependencies import ServicoIntrospeccaoDep, ServicoTokenDep
from app.schemas.introspeccao import IntrospeccaoForm, IntrospeccaoResposta
from app.schemas.token import CredenciaisClienteForm
from app.security.dependencias import CredenciaisBasic, resolver_credenciais_cliente

router = APIRouter(prefix="/oauth", tags=["Tokens"])


class IntrospeccaoRequisicao(CredenciaisClienteForm, IntrospeccaoForm):
    """Token a inspecionar somado às credenciais de quem consulta."""


@router.post(
    "/introspect",
    response_model=IntrospeccaoResposta,
    # Token inativo responde apenas {"active": false}, como na RFC 7662.
    response_model_exclude_none=True,
    summary="Consulta centralizada da situação de um token",
    description=(
        "Mecanismo **opcional**: a validação normal deve ser feita localmente pelos "
        "microsserviços, com a chave pública do JWKS. Este endpoint acrescenta o que o "
        "JWT sozinho não mostra — se o cliente ou a RPA foram revogados após a emissão.\n\n"
        "Exige credenciais de um cliente ativo. Token inválido, expirado ou de titular "
        "bloqueado devolve `active: false` com HTTP 200, como manda a RFC 7662."
    ),
)
async def introspectar(
    formulario: Annotated[IntrospeccaoRequisicao, Form()],
    basic: CredenciaisBasic,
    servico_token: ServicoTokenDep,
    servico_introspeccao: ServicoIntrospeccaoDep,
) -> IntrospeccaoResposta:
    client_id, client_secret = resolver_credenciais_cliente(
        basic, formulario.client_id, formulario.client_secret
    )
    solicitante = await servico_token.autenticar_cliente(client_id, client_secret)
    return await servico_introspeccao.introspectar(
        formulario.token, solicitante=solicitante.client_id
    )
