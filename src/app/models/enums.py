"""Enumerações persistidas como VARCHAR (evita ALTER TYPE em migrations)."""

from __future__ import annotations

from enum import StrEnum


class StatusAcesso(StrEnum):
    """Situação de um cliente OAuth2 ou de uma RPA."""

    ATIVO = "ativo"
    INATIVO = "inativo"
    REVOGADO = "revogado"

    @property
    def permite_emitir_token(self) -> bool:
        return self is StatusAcesso.ATIVO


class TipoCliente(StrEnum):
    """Público ao qual o cliente OAuth2 pertence."""

    SERVICO = "servico"
    RPA = "rpa"


class StatusChave(StrEnum):
    """Ciclo de vida de uma chave de assinatura JWT.

    - ``ativa``: assina os tokens novos (existe no máximo uma).
    - ``em_rotacao``: não assina mais, mas continua publicada no JWKS até que os
      tokens emitidos com ela expirem.
    - ``aposentada``: fora do JWKS; a chave privada já foi removida do Vault.
    """

    ATIVA = "ativa"
    EM_ROTACAO = "em_rotacao"
    APOSENTADA = "aposentada"

    @property
    def publicavel_no_jwks(self) -> bool:
        return self in (StatusChave.ATIVA, StatusChave.EM_ROTACAO)
