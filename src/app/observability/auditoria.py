"""Registro dos eventos de auditoria do serviço.

Todos os eventos passam pelo logger estruturado e, portanto, pelo filtro de
redação. Os nomes dos eventos são estáveis para permitir consultas no Loki.
"""

from __future__ import annotations

import logging
from typing import Any, Final

logger = logging.getLogger("app.auditoria")

# Eventos de auditoria conhecidos.
AUTENTICACAO_SUCESSO: Final = "autenticacao_sucesso"
AUTENTICACAO_FALHA: Final = "autenticacao_falha"
CLIENTE_CRIADO: Final = "cliente_criado"
RPA_CRIADA: Final = "rpa_criada"
SECRET_ROTACIONADO: Final = "secret_rotacionado"
ACESSO_REVOGADO: Final = "acesso_revogado"
CREDENCIAIS_ACESSADAS: Final = "credenciais_acessadas"
OPERACAO_ADMIN: Final = "operacao_admin"
INTROSPECCAO: Final = "introspeccao"
CHAVE_ROTACIONADA: Final = "chave_rotacionada"


def registrar(
    evento: str,
    mensagem: str,
    *,
    nivel: int = logging.INFO,
    **campos: Any,
) -> None:
    """Registra um evento de auditoria com campos estruturados adicionais."""
    logger.log(nivel, mensagem, extra={"evento": evento, **campos})


def registrar_falha(evento: str, mensagem: str, **campos: Any) -> None:
    registrar(evento, mensagem, nivel=logging.WARNING, **campos)
