"""Configuração da aplicação, carregada de variáveis de ambiente / .env."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ModoAutenticacaoAdmin = Literal["static", "entraid"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Aplicação
    app_name: str = "OAuth2 Auth Service"
    app_env: str = "development"
    log_level: str = "INFO"

    # Banco de dados
    database_url: str = "postgresql+asyncpg://oauth:oauth@localhost:5432/oauth"
    test_database_url: str = "postgresql+asyncpg://oauth:oauth@localhost:5432/oauth_test"

    # Vault
    vault_addr: str = "http://localhost:8200"
    vault_token: str = ""
    vault_kv_mount: str = "secret"
    vault_base_path: str = "oauth"

    # JWT
    jwt_issuer: str = "https://auth.interno"
    jwt_audience: str = "microservicos-internos"
    access_token_expire_minutes: int = Field(default=30, gt=0)
    key_rotation_grace_minutes: int = Field(default=35, gt=0)

    # Autenticação administrativa
    admin_auth_mode: ModoAutenticacaoAdmin = "static"
    admin_token: str | None = None
    entra_tenant_id: str | None = None
    entra_client_id: str | None = None

    @model_validator(mode="after")
    def _valida_autenticacao_admin(self) -> Settings:
        if self.admin_auth_mode == "static" and not self.admin_token:
            raise ValueError("ADMIN_TOKEN é obrigatório quando ADMIN_AUTH_MODE=static")
        if self.admin_auth_mode == "entraid" and not (
            self.entra_tenant_id and self.entra_client_id
        ):
            raise ValueError(
                "ENTRA_TENANT_ID e ENTRA_CLIENT_ID são obrigatórios quando ADMIN_AUTH_MODE=entraid"
            )
        return self

    @property
    def prefixo_vault(self) -> str:
        """Prefixo dos segredos da aplicação dentro do mount KV."""
        return self.vault_base_path.strip("/")


@lru_cache(maxsize=1)
def obter_settings() -> Settings:
    """Instância única de Settings (cacheada para uso como dependência do FastAPI)."""
    return Settings()
