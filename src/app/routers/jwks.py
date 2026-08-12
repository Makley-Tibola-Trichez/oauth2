"""Publicação das chaves públicas para validação local dos JWTs."""

from __future__ import annotations

from fastapi import APIRouter, Response

from app.dependencies import GerenciadorChavesDep
from app.schemas.jwks import JwksResposta

router = APIRouter(tags=["Infraestrutura"])

SEGUNDOS_DE_CACHE = 300


@router.get(
    "/.well-known/jwks.json",
    response_model=JwksResposta,
    summary="Chaves públicas (JWKS)",
    description=(
        "Permite que os microsserviços validem os tokens localmente, sem chamar este "
        "serviço a cada requisição. Servido a partir do PostgreSQL — não depende do Vault."
    ),
)
async def jwks(gerenciador: GerenciadorChavesDep, resposta: Response) -> JwksResposta:
    resposta.headers["Cache-Control"] = f"public, max-age={SEGUNDOS_DE_CACHE}"
    return JwksResposta(**await gerenciador.obter_jwks())
