"""Erros de negócio, traduzidos para HTTP pelos handlers registrados em ``main``."""

from __future__ import annotations

from fastapi import status


class ErroOAuth(Exception):
    """Falha nos endpoints de token/introspection, no formato da RFC 6749.

    A resposta sai como ``{"error": ..., "error_description": ...}``.
    """

    erro = "invalid_request"
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, descricao: str) -> None:
        super().__init__(descricao)
        self.descricao = descricao


class CredenciaisInvalidasError(ErroOAuth):
    """``client_id``/``client_secret`` não conferem. Mensagem propositalmente genérica."""

    erro = "invalid_client"
    status_code = status.HTTP_401_UNAUTHORIZED

    def __init__(self, descricao: str = "Credenciais de cliente inválidas") -> None:
        super().__init__(descricao)


class AcessoBloqueadoError(ErroOAuth):
    """Cliente ou RPA existe, mas está inativo ou revogado."""

    erro = "invalid_client"
    status_code = status.HTTP_403_FORBIDDEN


class RpaNaoAutorizadaError(ErroOAuth):
    """O ``rpa_id`` informado não está autorizado no Vault."""

    erro = "invalid_request"
    status_code = status.HTTP_400_BAD_REQUEST


class GrantTypeNaoSuportadoError(ErroOAuth):
    erro = "unsupported_grant_type"
    status_code = status.HTTP_400_BAD_REQUEST


class ErroDeNegocio(Exception):
    """Falha nos endpoints administrativos, respondida como ``{"detail": ...}``."""

    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, detalhe: str) -> None:
        super().__init__(detalhe)
        self.detalhe = detalhe


class RecursoNaoEncontradoError(ErroDeNegocio):
    status_code = status.HTTP_404_NOT_FOUND


class RecursoDuplicadoError(ErroDeNegocio):
    status_code = status.HTTP_409_CONFLICT


class OperacaoNaoPermitidaError(ErroDeNegocio):
    status_code = status.HTTP_403_FORBIDDEN
