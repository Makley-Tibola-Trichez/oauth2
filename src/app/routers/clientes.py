"""Gestão de clientes OAuth2 — exige autenticação administrativa."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.dependencies import ServicoClienteDep
from app.observability import auditoria
from app.schemas.cliente import (
    ClienteCriacaoRequest,
    ClienteCriadoResposta,
    ClienteResposta,
    SecretRotacionadoResposta,
)
from app.security.dependencias import AdminDep

router = APIRouter(prefix="/oauth/clients", tags=["Administração de clientes"])


@router.post(
    "",
    response_model=ClienteCriadoResposta,
    status_code=status.HTTP_201_CREATED,
    summary="Cria um novo cliente OAuth2",
    description="O `client_secret` é gerado aqui e devolvido **uma única vez**.",
)
async def criar_cliente(
    dados: ClienteCriacaoRequest,
    servico: ServicoClienteDep,
    admin: AdminDep,
) -> ClienteCriadoResposta:
    cliente, secret = await servico.criar(dados, admin)
    auditoria.registrar(
        auditoria.OPERACAO_ADMIN,
        "Criação de cliente",
        operacao="criar_cliente",
        client_id=cliente.client_id,
        admin=admin.identificador,
    )
    return ClienteCriadoResposta(
        **ClienteResposta.model_validate(cliente).model_dump(),
        client_secret=secret,
    )


@router.get(
    "/{client_id}",
    response_model=ClienteResposta,
    summary="Consulta um cliente",
)
async def obter_cliente(
    client_id: str,
    servico: ServicoClienteDep,
    admin: AdminDep,
) -> ClienteResposta:
    cliente = await servico.obter(client_id)
    return ClienteResposta.model_validate(cliente)


@router.post(
    "/{client_id}/rotate-secret",
    response_model=SecretRotacionadoResposta,
    summary="Rotaciona o client_secret",
    description="Gera um novo secret e invalida o anterior imediatamente.",
)
async def rotacionar_secret(
    client_id: str,
    servico: ServicoClienteDep,
    admin: AdminDep,
) -> SecretRotacionadoResposta:
    cliente, novo_secret = await servico.rotacionar_secret(client_id, admin)
    auditoria.registrar(
        auditoria.OPERACAO_ADMIN,
        "Rotação de secret",
        operacao="rotacionar_secret",
        client_id=cliente.client_id,
        admin=admin.identificador,
    )
    return SecretRotacionadoResposta(
        client_id=cliente.client_id,
        client_secret=novo_secret,
        secret_rotacionado_em=cliente.secret_rotacionado_em,  # type: ignore[arg-type]
    )


@router.post(
    "/{client_id}/revoke",
    response_model=ClienteResposta,
    summary="Revoga um cliente",
    description="Cliente revogado não obtém novos tokens; a operação é idempotente.",
)
async def revogar_cliente(
    client_id: str,
    servico: ServicoClienteDep,
    admin: AdminDep,
) -> ClienteResposta:
    cliente = await servico.revogar(client_id, admin)
    auditoria.registrar(
        auditoria.OPERACAO_ADMIN,
        "Revogação de cliente",
        operacao="revogar_cliente",
        client_id=cliente.client_id,
        admin=admin.identificador,
    )
    return ClienteResposta.model_validate(cliente)
