"""Geração de pares RSA e conversão de chave pública para JWK.

Funções puras — sem banco e sem Vault — para facilitar os testes.
"""

from __future__ import annotations

import base64
import hashlib
import json
from dataclasses import dataclass
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicKey

ALGORITMO_PADRAO = "RS256"
TAMANHO_CHAVE_PADRAO = 2048


@dataclass(frozen=True, slots=True)
class ParDeChaves:
    kid: str
    chave_privada_pem: str
    chave_publica_pem: str
    algoritmo: str = ALGORITMO_PADRAO


def _base64url(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).decode().rstrip("=")


def _inteiro_para_base64url(valor: int) -> str:
    tamanho = (valor.bit_length() + 7) // 8
    return _base64url(valor.to_bytes(tamanho, "big"))


def carregar_chave_publica(pem: str) -> RSAPublicKey:
    chave = serialization.load_pem_public_key(pem.encode())
    if not isinstance(chave, RSAPublicKey):
        raise ValueError("A chave pública informada não é RSA")
    return chave


def chave_publica_para_jwk(
    pem: str,
    kid: str,
    algoritmo: str = ALGORITMO_PADRAO,
) -> dict[str, Any]:
    """Monta a entrada de JWKS correspondente à chave pública."""
    numeros = carregar_chave_publica(pem).public_numbers()
    return {
        "kty": "RSA",
        "use": "sig",
        "alg": algoritmo,
        "kid": kid,
        "n": _inteiro_para_base64url(numeros.n),
        "e": _inteiro_para_base64url(numeros.e),
    }


def calcular_kid(pem: str) -> str:
    """``kid`` derivado da thumbprint da chave pública (RFC 7638).

    Ser determinístico evita colisões e permite reconhecer a mesma chave em
    ambientes diferentes.
    """
    numeros = carregar_chave_publica(pem).public_numbers()
    canonico = json.dumps(
        {
            "e": _inteiro_para_base64url(numeros.e),
            "kty": "RSA",
            "n": _inteiro_para_base64url(numeros.n),
        },
        separators=(",", ":"),
        sort_keys=True,
    )
    return _base64url(hashlib.sha256(canonico.encode()).digest())[:32]


def gerar_par_de_chaves(tamanho: int = TAMANHO_CHAVE_PADRAO) -> ParDeChaves:
    privada = rsa.generate_private_key(public_exponent=65537, key_size=tamanho)

    privada_pem = privada.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    publica_pem = (
        privada.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )

    return ParDeChaves(
        kid=calcular_kid(publica_pem),
        chave_privada_pem=privada_pem,
        chave_publica_pem=publica_pem,
    )
