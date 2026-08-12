"""Regras de gestão das RPAs e do acesso às suas credenciais.

O cadastro e o status ficam no PostgreSQL; a autorização do ``rpa_id`` e as
credenciais ficam no Vault. As duas fontes precisam concordar.
"""

from __future__ import annotations

import logging
from typing import Any

from app.models.base import agora_utc
from app.models.enums import StatusAcesso
from app.models.rpa import Rpa
from app.observability import auditoria
from app.repositories.protocolos import RpaRepositorio
from app.schemas.rpa import RpaCriacaoRequest
from app.security.admin_auth import IdentidadeAdmin
from app.security.jwt_service import ClaimsToken, TipoToken
from app.services.erros import (
    AcessoBloqueadoError,
    OperacaoNaoPermitidaError,
    RecursoDuplicadoError,
    RecursoNaoEncontradoError,
)
from app.vault.caminhos import caminho_rpa
from app.vault.client import VaultClient

logger = logging.getLogger("app.rpas")


class ServicoRpa:
    def __init__(self, rpa_repositorio: RpaRepositorio, vault: VaultClient) -> None:
        self._rpas = rpa_repositorio
        self._vault = vault

    async def criar(self, dados: RpaCriacaoRequest, admin: IdentidadeAdmin) -> Rpa:
        """Cadastra a RPA e a autoriza no Vault.

        O segredo é gravado antes do commit: se a transação falhar, sobra um
        caminho no Vault sem cadastro correspondente — e a emissão de token
        exige as duas coisas, então nada é liberado indevidamente.
        """
        if await self._rpas.buscar_por_rpa_id(dados.rpa_id) is not None:
            raise RecursoDuplicadoError(f"Já existe uma RPA com rpa_id '{dados.rpa_id}'")

        await self._vault.gravar_segredo(
            caminho_rpa(dados.rpa_id),
            {"credenciais": dados.credenciais, "criado_em": agora_utc().isoformat()},
        )

        rpa = Rpa(
            rpa_id=dados.rpa_id,
            nome=dados.nome,
            descricao=dados.descricao,
            status=StatusAcesso.ATIVO,
        )
        await self._rpas.salvar(rpa)
        await self._rpas.confirmar()

        auditoria.registrar(
            auditoria.RPA_CRIADA,
            "RPA cadastrada e autorizada no Vault",
            rpa_id=rpa.rpa_id,
            admin=admin.identificador,
            origem_admin=admin.origem,
        )
        return rpa

    async def buscar(self, rpa_id: str) -> Rpa | None:
        """Busca sem erro quando não existe — útil para fluxos idempotentes."""
        return await self._rpas.buscar_por_rpa_id(rpa_id)

    async def obter(self, rpa_id: str) -> Rpa:
        rpa = await self.buscar(rpa_id)
        if rpa is None:
            raise RecursoNaoEncontradoError(f"RPA '{rpa_id}' não encontrada")
        return rpa

    async def revogar(self, rpa_id: str, admin: IdentidadeAdmin) -> Rpa:
        """Revoga a RPA no banco e retira a autorização do Vault."""
        rpa = await self.obter(rpa_id)

        if StatusAcesso(rpa.status) is not StatusAcesso.REVOGADO:
            rpa.status = StatusAcesso.REVOGADO
            rpa.revogado_em = agora_utc()
            await self._rpas.salvar(rpa)
            await self._rpas.confirmar()

        await self._vault.remover_segredo(caminho_rpa(rpa_id))

        auditoria.registrar(
            auditoria.ACESSO_REVOGADO,
            "RPA revogada e removida do Vault",
            rpa_id=rpa.rpa_id,
            admin=admin.identificador,
            origem_admin=admin.origem,
        )
        return rpa

    async def listar(self) -> list[Rpa]:
        return await self._rpas.listar()

    async def obter_credenciais(self, rpa_id: str, claims: ClaimsToken) -> dict[str, Any]:
        """Entrega as credenciais do Vault para a própria RPA autenticada."""
        if claims.tipo is not TipoToken.RPA or claims.rpa_id != rpa_id:
            auditoria.registrar_falha(
                auditoria.CREDENCIAIS_ACESSADAS,
                "Tentativa de ler credenciais de outra RPA",
                rpa_id_solicitado=rpa_id,
                rpa_id_do_token=claims.rpa_id,
                sub=claims.sub,
            )
            raise OperacaoNaoPermitidaError("O token não autoriza acesso às credenciais desta RPA")

        rpa = await self.obter(rpa_id)
        if not rpa.pode_emitir_token:
            raise AcessoBloqueadoError(
                f"RPA com status '{rpa.status}' não pode acessar credenciais"
            )

        segredo = await self._vault.ler_segredo(caminho_rpa(rpa_id))
        if segredo is None:
            raise RecursoNaoEncontradoError(f"Não há credenciais armazenadas para a RPA '{rpa_id}'")

        auditoria.registrar(
            auditoria.CREDENCIAIS_ACESSADAS,
            "Credenciais da RPA consultadas",
            rpa_id=rpa_id,
            sub=claims.sub,
            jti=claims.jti,
        )
        return dict(segredo.get("credenciais") or {})
