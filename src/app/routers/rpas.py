"""Gestão de RPAs e acesso das RPAs às suas credenciais."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.dependencies import ServicoRpaDep
from app.observability import auditoria
from app.schemas.rpa import CredenciaisRpaResposta, RpaCriacaoRequest, RpaResposta
from app.security.dependencias import AdminDep, ClaimsTokenDep

router = APIRouter(prefix="/oauth/rpas", tags=["Administração de RPAs"])


@router.post(
    "",
    response_model=RpaResposta,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra e autoriza uma RPA",
    description=(
        "Grava o cadastro no PostgreSQL e as credenciais no Vault. A partir daí o "
        "`rpa_id` passa a ser aceito em `POST /oauth/rpa/token`."
    ),
)
async def criar_rpa(
    dados: RpaCriacaoRequest,
    servico: ServicoRpaDep,
    admin: AdminDep,
) -> RpaResposta:
    rpa = await servico.criar(dados, admin)
    auditoria.registrar(
        auditoria.OPERACAO_ADMIN,
        "Criação de RPA",
        operacao="criar_rpa",
        rpa_id=rpa.rpa_id,
        admin=admin.identificador,
    )
    return RpaResposta.model_validate(rpa)


@router.get(
    "/{rpa_id}",
    response_model=RpaResposta,
    summary="Consulta uma RPA",
)
async def obter_rpa(
    rpa_id: str,
    servico: ServicoRpaDep,
    admin: AdminDep,
) -> RpaResposta:
    rpa = await servico.obter(rpa_id)
    return RpaResposta.model_validate(rpa)


@router.post(
    "/{rpa_id}/revoke",
    response_model=RpaResposta,
    summary="Revoga uma RPA",
    description="Marca a RPA como revogada e remove a autorização do Vault.",
)
async def revogar_rpa(
    rpa_id: str,
    servico: ServicoRpaDep,
    admin: AdminDep,
) -> RpaResposta:
    rpa = await servico.revogar(rpa_id, admin)
    auditoria.registrar(
        auditoria.OPERACAO_ADMIN,
        "Revogação de RPA",
        operacao="revogar_rpa",
        rpa_id=rpa.rpa_id,
        admin=admin.identificador,
    )
    return RpaResposta.model_validate(rpa)


@router.get(
    "/{rpa_id}/credentials",
    response_model=CredenciaisRpaResposta,
    tags=["RPAs"],
    summary="Consulta as credenciais da própria RPA",
    description=(
        "Autenticado com o access token da RPA (`tipo=rpa`). O `rpa_id` do token "
        "precisa ser o mesmo da rota — uma RPA nunca lê credenciais de outra."
    ),
)
async def obter_credenciais_rpa(
    rpa_id: str,
    servico: ServicoRpaDep,
    claims: ClaimsTokenDep,
) -> CredenciaisRpaResposta:
    credenciais = await servico.obter_credenciais(rpa_id, claims)
    return CredenciaisRpaResposta(rpa_id=rpa_id, credenciais=credenciais)
