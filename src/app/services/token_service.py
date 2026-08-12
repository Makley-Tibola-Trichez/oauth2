"""Regras de emissão de token para RPAs e microsserviços.

O fluxo da RPA é OAuth2 Client Credentials com um parâmetro adicional,
``rpa_id``. Esse valor chega pela requisição e **não é confiável**: só vira
claim depois de confirmado no Vault e no cadastro.
"""

from __future__ import annotations

import logging

from app.models.cliente import Cliente
from app.models.enums import StatusAcesso, TipoCliente
from app.observability import auditoria
from app.repositories.protocolos import ClienteRepositorio, RpaRepositorio
from app.security.hashing import HasherSecret, hasher_padrao
from app.security.jwt_service import ServicoJwt, TipoToken, TokenEmitido
from app.services.erros import (
    AcessoBloqueadoError,
    CredenciaisInvalidasError,
    RpaNaoAutorizadaError,
)
from app.vault.caminhos import caminho_rpa
from app.vault.client import VaultClient

logger = logging.getLogger("app.token")

# Hash descartável usado quando o client_id não existe, para que a resposta
# leve o mesmo tempo de um secret errado e não vire um oráculo de existência.
_HASH_FICTICIO = hasher_padrao.gerar_hash("cliente-inexistente")


class ServicoToken:
    def __init__(
        self,
        cliente_repositorio: ClienteRepositorio,
        rpa_repositorio: RpaRepositorio,
        vault: VaultClient,
        servico_jwt: ServicoJwt,
        *,
        hasher: HasherSecret | None = None,
    ) -> None:
        self._clientes = cliente_repositorio
        self._rpas = rpa_repositorio
        self._vault = vault
        self._jwt = servico_jwt
        self._hasher = hasher or hasher_padrao

    # -- microsserviços ---------------------------------------------------

    async def emitir_para_servico(self, client_id: str, client_secret: str) -> TokenEmitido:
        cliente = await self.autenticar_cliente(
            client_id, client_secret, tipo_esperado=TipoCliente.SERVICO
        )

        token = await self._jwt.emitir(sub=cliente.client_id, tipo=TipoToken.SERVICE)

        auditoria.registrar(
            auditoria.AUTENTICACAO_SUCESSO,
            "Token emitido para microsserviço",
            client_id=cliente.client_id,
            tipo=TipoToken.SERVICE.value,
            jti=token.jti,
            kid=token.kid,
        )
        return token

    # -- RPAs -------------------------------------------------------------

    async def emitir_para_rpa(
        self,
        client_id: str,
        client_secret: str,
        rpa_id: str,
    ) -> TokenEmitido:
        cliente = await self.autenticar_cliente(
            client_id, client_secret, tipo_esperado=TipoCliente.RPA
        )
        await self._garantir_rpa_autorizada(rpa_id, client_id=cliente.client_id)

        token = await self._jwt.emitir(
            sub=cliente.client_id,
            tipo=TipoToken.RPA,
            rpa_id=rpa_id,
        )

        auditoria.registrar(
            auditoria.AUTENTICACAO_SUCESSO,
            "Token emitido para RPA",
            client_id=cliente.client_id,
            rpa_id=rpa_id,
            tipo=TipoToken.RPA.value,
            jti=token.jti,
            kid=token.kid,
        )
        return token

    async def _garantir_rpa_autorizada(self, rpa_id: str, *, client_id: str) -> None:
        """Confirma o ``rpa_id`` no Vault e o cadastro/status no PostgreSQL."""
        if not await self._vault.existe(caminho_rpa(rpa_id)):
            auditoria.registrar_falha(
                auditoria.AUTENTICACAO_FALHA,
                "rpa_id não autorizado no Vault",
                client_id=client_id,
                rpa_id=rpa_id,
                motivo="rpa_nao_encontrada_no_vault",
            )
            raise RpaNaoAutorizadaError("rpa_id não autorizado")

        rpa = await self._rpas.buscar_por_rpa_id(rpa_id)
        if rpa is None:
            auditoria.registrar_falha(
                auditoria.AUTENTICACAO_FALHA,
                "rpa_id sem cadastro correspondente",
                client_id=client_id,
                rpa_id=rpa_id,
                motivo="rpa_nao_cadastrada",
            )
            raise RpaNaoAutorizadaError("rpa_id não autorizado")

        if not rpa.pode_emitir_token:
            auditoria.registrar_falha(
                auditoria.AUTENTICACAO_FALHA,
                "RPA sem permissão para obter token",
                client_id=client_id,
                rpa_id=rpa_id,
                status_rpa=str(rpa.status),
                motivo="rpa_bloqueada",
            )
            raise AcessoBloqueadoError(f"RPA com status '{rpa.status}' não pode obter token")

    # -- autenticação do cliente -----------------------------------------

    async def autenticar_cliente(
        self,
        client_id: str,
        client_secret: str,
        *,
        tipo_esperado: TipoCliente | None = None,
    ) -> Cliente:
        """Valida credenciais e status. Sem ``tipo_esperado``, aceita qualquer público.

        Usada tanto pelos fluxos de token quanto pela introspection, que exige
        um cliente autenticado mas não se importa com o tipo dele.
        """
        cliente = await self._clientes.buscar_por_client_id(client_id) if client_id else None

        if cliente is None:
            self._hasher.verificar(client_secret or "", _HASH_FICTICIO)
            auditoria.registrar_falha(
                auditoria.AUTENTICACAO_FALHA,
                "Cliente não encontrado",
                client_id=client_id,
                motivo="client_id_inexistente",
            )
            raise CredenciaisInvalidasError

        if not self._hasher.verificar(client_secret or "", cliente.client_secret_hash):
            auditoria.registrar_falha(
                auditoria.AUTENTICACAO_FALHA,
                "client_secret inválido",
                client_id=client_id,
                motivo="secret_invalido",
            )
            raise CredenciaisInvalidasError

        if tipo_esperado is not None and TipoCliente(cliente.tipo) is not tipo_esperado:
            auditoria.registrar_falha(
                auditoria.AUTENTICACAO_FALHA,
                "Cliente usou o fluxo de token do outro público",
                client_id=client_id,
                tipo_cliente=str(cliente.tipo),
                tipo_esperado=tipo_esperado.value,
                motivo="tipo_incompatível",
            )
            raise CredenciaisInvalidasError

        if not cliente.pode_emitir_token:
            auditoria.registrar_falha(
                auditoria.AUTENTICACAO_FALHA,
                "Cliente inativo ou revogado",
                client_id=client_id,
                status_cliente=str(cliente.status),
                motivo="cliente_bloqueado",
            )
            raise AcessoBloqueadoError(
                f"Cliente com status '{StatusAcesso(cliente.status).value}' não pode obter token"
            )

        return cliente
