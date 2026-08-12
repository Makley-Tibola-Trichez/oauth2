"""Layout dos segredos da aplicação dentro do Vault.

Centralizado aqui para que a convenção fique em um lugar só:

    {mount}/{prefixo}/jwt/keys/{kid}   -> {"chave_privada_pem": "..."}
    {mount}/{prefixo}/rpa/{rpa_id}     -> {"credenciais": {...}, "criado_em": "..."}
"""

from __future__ import annotations


def caminho_chave_privada(kid: str) -> str:
    return f"jwt/keys/{kid}"


def caminho_rpa(rpa_id: str) -> str:
    return f"rpa/{rpa_id}"
