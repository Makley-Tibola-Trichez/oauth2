"""Regras de gestão dos clientes OAuth2 (operações administrativas)."""

from __future__ import annotations

import logging

from app.models.base import agora_utc
from app.models.cliente import Cliente
from app.models.enums import StatusAcesso
from app.observability import auditoria
from app.repositories.protocolos import ClienteRepositorio
from app.schemas.cliente import ClienteCriacaoRequest
from app.security.admin_auth import IdentidadeAdmin
from app.security.gerador_secret import gerar_client_id, gerar_client_secret
from app.security.hashing import HasherSecret, hasher_padrao
from app.services.erros import RecursoDuplicadoError, RecursoNaoEncontradoError

logger = logging.getLogger("app.clientes")


class ServicoCliente:
    def __init__(
        self,
        cliente_repositorio: ClienteRepositorio,
        *,
        hasher: HasherSecret | None = None,
    ) -> None:
        self._clientes = cliente_repositorio
        self._hasher = hasher or hasher_padrao

    async def criar(
        self,
        dados: ClienteCriacaoRequest,
        admin: IdentidadeAdmin,
    ) -> tuple[Cliente, str]:
        """Cria o cliente e devolve o secret em texto puro — exibido uma única vez."""
        client_id = dados.client_id or gerar_client_id(dados.tipo.value)

        if await self._clientes.buscar_por_client_id(client_id) is not None:
            raise RecursoDuplicadoError(f"Já existe um cliente com client_id '{client_id}'")

        secret = gerar_client_secret()
        cliente = Cliente(
            client_id=client_id,
            client_secret_hash=self._hasher.gerar_hash(secret),
            nome=dados.nome,
            descricao=dados.descricao,
            tipo=dados.tipo,
            status=StatusAcesso.ATIVO,
        )
        await self._clientes.salvar(cliente)
        await self._clientes.confirmar()

        auditoria.registrar(
            auditoria.CLIENTE_CRIADO,
            "Cliente OAuth2 criado",
            client_id=cliente.client_id,
            tipo_cliente=str(cliente.tipo),
            admin=admin.identificador,
            origem_admin=admin.origem,
        )
        return cliente, secret

    async def buscar(self, client_id: str) -> Cliente | None:
        """Busca sem erro quando não existe — útil para fluxos idempotentes."""
        return await self._clientes.buscar_por_client_id(client_id)

    async def obter(self, client_id: str) -> Cliente:
        cliente = await self.buscar(client_id)
        if cliente is None:
            raise RecursoNaoEncontradoError(f"Cliente '{client_id}' não encontrado")
        return cliente

    async def rotacionar_secret(
        self, client_id: str, admin: IdentidadeAdmin
    ) -> tuple[Cliente, str]:
        """Gera um novo secret; o anterior deixa de valer no mesmo instante."""
        cliente = await self.obter(client_id)

        novo_secret = gerar_client_secret()
        cliente.client_secret_hash = self._hasher.gerar_hash(novo_secret)
        cliente.secret_rotacionado_em = agora_utc()
        await self._clientes.salvar(cliente)
        await self._clientes.confirmar()

        auditoria.registrar(
            auditoria.SECRET_ROTACIONADO,
            "client_secret rotacionado",
            client_id=cliente.client_id,
            admin=admin.identificador,
            origem_admin=admin.origem,
        )
        return cliente, novo_secret

    async def revogar(self, client_id: str, admin: IdentidadeAdmin) -> Cliente:
        cliente = await self.obter(client_id)

        if StatusAcesso(cliente.status) is not StatusAcesso.REVOGADO:
            cliente.status = StatusAcesso.REVOGADO
            cliente.revogado_em = agora_utc()
            await self._clientes.salvar(cliente)
            await self._clientes.confirmar()

        auditoria.registrar(
            auditoria.ACESSO_REVOGADO,
            "Cliente revogado",
            client_id=cliente.client_id,
            admin=admin.identificador,
            origem_admin=admin.origem,
        )
        return cliente

    async def listar(self) -> list[Cliente]:
        return await self._clientes.listar()
