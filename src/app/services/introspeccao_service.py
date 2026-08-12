"""Introspection (RFC 7662) — validação centralizada e opcional.

A validação normal é local, feita pelos microsserviços com a chave pública do
JWKS. O valor deste endpoint é enxergar o que o JWT sozinho não mostra: se o
cliente ou a RPA foram revogados depois da emissão do token.
"""

from __future__ import annotations

import logging

from app.models.enums import StatusAcesso
from app.observability import auditoria
from app.repositories.protocolos import ClienteRepositorio, RpaRepositorio
from app.schemas.introspeccao import IntrospeccaoResposta
from app.security.jwt_service import ClaimsToken, ServicoJwt, TipoToken, TokenInvalidoError

logger = logging.getLogger("app.introspeccao")

INATIVO = IntrospeccaoResposta(active=False)


class ServicoIntrospeccao:
    def __init__(
        self,
        servico_jwt: ServicoJwt,
        cliente_repositorio: ClienteRepositorio,
        rpa_repositorio: RpaRepositorio,
    ) -> None:
        self._jwt = servico_jwt
        self._clientes = cliente_repositorio
        self._rpas = rpa_repositorio

    async def introspectar(
        self, token: str, *, solicitante: str | None = None
    ) -> IntrospeccaoResposta:
        try:
            claims = await self._jwt.validar(token)
        except TokenInvalidoError as erro:
            auditoria.registrar(
                auditoria.INTROSPECCAO,
                "Token inspecionado considerado inativo",
                solicitante=solicitante,
                motivo=str(erro),
                ativo=False,
            )
            return INATIVO

        if not await self._sujeito_continua_ativo(claims):
            auditoria.registrar(
                auditoria.INTROSPECCAO,
                "Token válido, porém o titular está inativo ou revogado",
                solicitante=solicitante,
                sub=claims.sub,
                rpa_id=claims.rpa_id,
                jti=claims.jti,
                ativo=False,
            )
            return INATIVO

        auditoria.registrar(
            auditoria.INTROSPECCAO,
            "Token inspecionado e considerado ativo",
            solicitante=solicitante,
            sub=claims.sub,
            rpa_id=claims.rpa_id,
            jti=claims.jti,
            ativo=True,
        )
        return IntrospeccaoResposta(
            active=True,
            sub=claims.sub,
            tipo=claims.tipo.value,
            rpa_id=claims.rpa_id,
            client_id=claims.sub,
            iss=claims.iss,
            aud=claims.aud,
            iat=int(claims.iat.timestamp()),
            exp=int(claims.exp.timestamp()),
            jti=claims.jti,
            token_type="Bearer",
        )

    async def _sujeito_continua_ativo(self, claims: ClaimsToken) -> bool:
        cliente = await self._clientes.buscar_por_client_id(claims.sub)
        if cliente is None or StatusAcesso(cliente.status) is not StatusAcesso.ATIVO:
            return False

        if claims.tipo is TipoToken.RPA:
            if claims.rpa_id is None:
                return False
            rpa = await self._rpas.buscar_por_rpa_id(claims.rpa_id)
            if rpa is None or StatusAcesso(rpa.status) is not StatusAcesso.ATIVO:
                return False

        return True
