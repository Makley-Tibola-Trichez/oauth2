"""Entidades persistidas. Importar daqui garante que o Alembic enxergue tudo."""

from app.models.chave_jwt import ChaveJwt
from app.models.cliente import Cliente
from app.models.enums import StatusAcesso, StatusChave, TipoCliente
from app.models.rpa import Rpa

__all__ = [
    "ChaveJwt",
    "Cliente",
    "Rpa",
    "StatusAcesso",
    "StatusChave",
    "TipoCliente",
]
