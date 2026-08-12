"""Emissão e validação dos JWTs de acesso.

Assinatura assimétrica (RS256): o serviço assina com a privada guardada no
Vault e os microsserviços validam localmente com a pública publicada no JWKS.
O ``kid`` no cabeçalho identifica a chave e viabiliza a rotação.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from app.security.key_manager import GerenciadorChaves

TIPO_TOKEN_BEARER = "Bearer"

# Claims que todo token emitido por este serviço precisa ter.
CLAIMS_OBRIGATORIAS = ["sub", "iss", "aud", "iat", "exp", "jti", "tipo"]


class TipoToken(StrEnum):
    """Valor do claim ``tipo``, que separa os dois públicos do serviço."""

    RPA = "rpa"
    SERVICE = "service"


class TokenInvalidoError(Exception):
    """Token ausente, malformado, com assinatura inválida ou claims faltando."""


class TokenExpiradoError(TokenInvalidoError):
    """Token bem formado, porém fora da validade."""


@dataclass(frozen=True, slots=True)
class TokenEmitido:
    access_token: str
    expires_in: int
    jti: str
    expira_em: datetime
    kid: str
    token_type: str = TIPO_TOKEN_BEARER


@dataclass(frozen=True, slots=True)
class ClaimsToken:
    sub: str
    tipo: TipoToken
    iss: str
    aud: str
    iat: datetime
    exp: datetime
    jti: str
    rpa_id: str | None = None

    @classmethod
    def de_payload(cls, payload: dict[str, Any]) -> ClaimsToken:
        return cls(
            sub=payload["sub"],
            tipo=TipoToken(payload["tipo"]),
            iss=payload["iss"],
            aud=payload["aud"],
            iat=datetime.fromtimestamp(payload["iat"], tz=UTC),
            exp=datetime.fromtimestamp(payload["exp"], tz=UTC),
            jti=payload["jti"],
            rpa_id=payload.get("rpa_id"),
        )


class ServicoJwt:
    def __init__(
        self,
        gerenciador_chaves: GerenciadorChaves,
        *,
        issuer: str,
        audience: str,
        expiracao_minutos: int = 30,
    ) -> None:
        self._chaves = gerenciador_chaves
        self._issuer = issuer
        self._audience = audience
        self._expiracao_minutos = expiracao_minutos

    async def emitir(
        self,
        *,
        sub: str,
        tipo: TipoToken,
        rpa_id: str | None = None,
    ) -> TokenEmitido:
        chave = await self._chaves.obter_chave_de_assinatura()

        emitido_em = datetime.now(UTC).replace(microsecond=0)
        expira_em = emitido_em + timedelta(minutes=self._expiracao_minutos)
        jti = str(uuid.uuid4())

        payload: dict[str, Any] = {
            "sub": sub,
            "tipo": tipo.value,
            "iss": self._issuer,
            "aud": self._audience,
            "iat": int(emitido_em.timestamp()),
            "exp": int(expira_em.timestamp()),
            "jti": jti,
        }
        if rpa_id is not None:
            payload["rpa_id"] = rpa_id

        token = jwt.encode(
            payload,
            chave.chave_privada_pem,
            algorithm=chave.algoritmo,
            headers={"kid": chave.kid, "typ": "JWT"},
        )

        return TokenEmitido(
            access_token=token,
            expires_in=self._expiracao_minutos * 60,
            jti=jti,
            expira_em=expira_em,
            kid=chave.kid,
        )

    async def validar(self, token: str) -> ClaimsToken:
        """Valida assinatura, ``iss``/``aud`` e validade, resolvendo a chave pelo ``kid``."""
        if not token:
            raise TokenInvalidoError("Token não informado")

        try:
            cabecalho = jwt.get_unverified_header(token)
        except InvalidTokenError as erro:
            raise TokenInvalidoError("Cabeçalho do token inválido") from erro

        kid = cabecalho.get("kid")
        if not kid:
            raise TokenInvalidoError("Token sem kid no cabeçalho")

        chave = await self._chaves.obter_chave_publica(kid)
        if chave is None:
            raise TokenInvalidoError(f"Chave {kid} desconhecida ou aposentada")

        try:
            payload = jwt.decode(
                token,
                chave.chave_publica_pem,
                # Algoritmo do registro da chave, nunca o do cabeçalho do token:
                # aceitar o "alg" recebido abriria espaço para algorithm confusion.
                algorithms=[chave.algoritmo],
                issuer=self._issuer,
                audience=self._audience,
                options={"require": CLAIMS_OBRIGATORIAS},
            )
        except ExpiredSignatureError as erro:
            raise TokenExpiradoError("Token expirado") from erro
        except InvalidTokenError as erro:
            raise TokenInvalidoError(f"Token inválido: {erro}") from erro

        try:
            return ClaimsToken.de_payload(payload)
        except (KeyError, ValueError) as erro:
            raise TokenInvalidoError("Claims do token em formato inesperado") from erro
