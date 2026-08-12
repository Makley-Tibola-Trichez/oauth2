"""Hash do ``client_secret``.

O secret em texto puro só existe no instante em que é gerado e devolvido ao
administrador; o banco guarda exclusivamente o hash Argon2id.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error, InvalidHashError


class HasherSecret:
    """Fachada sobre o Argon2id com verificação que nunca levanta exceção."""

    def __init__(self, hasher: PasswordHasher | None = None) -> None:
        self._hasher = hasher or PasswordHasher()

    def gerar_hash(self, secret: str) -> str:
        return self._hasher.hash(secret)

    def verificar(self, secret: str, hash_armazenado: str) -> bool:
        """Compara o secret com o hash. Retorna ``False`` em qualquer falha."""
        try:
            return self._hasher.verify(hash_armazenado, secret)
        except (Argon2Error, InvalidHashError, TypeError, ValueError):
            return False

    def precisa_rehash(self, hash_armazenado: str) -> bool:
        try:
            return self._hasher.check_needs_rehash(hash_armazenado)
        except (InvalidHashError, TypeError, ValueError):
            return False


hasher_padrao = HasherSecret()
