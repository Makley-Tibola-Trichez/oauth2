"""Configuração comum dos testes.

As variáveis de ambiente são definidas **antes** de qualquer import da
aplicação, para que as settings não dependam do `.env` da máquina.
"""

from __future__ import annotations

import os

URL_BANCO_DE_TESTE = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://oauth:oauth@localhost:5432/oauth_test",
)

TOKEN_ADMIN_DE_TESTE = "token-admin-de-teste"
ISSUER_DE_TESTE = "https://auth.testes"
AUDIENCE_DE_TESTE = "microservicos-de-teste"

os.environ.update(
    {
        "APP_ENV": "test",
        "LOG_LEVEL": "WARNING",
        "DATABASE_URL": URL_BANCO_DE_TESTE,
        "TEST_DATABASE_URL": URL_BANCO_DE_TESTE,
        "ADMIN_AUTH_MODE": "static",
        "ADMIN_TOKEN": TOKEN_ADMIN_DE_TESTE,
        "JWT_ISSUER": ISSUER_DE_TESTE,
        "JWT_AUDIENCE": AUDIENCE_DE_TESTE,
        "ACCESS_TOKEN_EXPIRE_MINUTES": "30",
        "KEY_ROTATION_GRACE_MINUTES": "35",
        "VAULT_ADDR": os.getenv("VAULT_ADDR", "http://localhost:8200"),
        "VAULT_TOKEN": os.getenv("VAULT_TOKEN", "dev-root-token"),
    }
)
