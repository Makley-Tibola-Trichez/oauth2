"""Ambiente do Alembic.

A URL do banco vem das settings da aplicação (ou de ``ALEMBIC_DATABASE_URL``,
usado pelos testes de integração), nunca do ``alembic.ini``.
"""

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

# Torna o pacote da aplicação importável quando o Alembic roda da raiz do projeto.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app.config import obter_settings  # noqa: E402
from app.models import ChaveJwt, Cliente, Rpa  # noqa: E402,F401  (registra as tabelas)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def obter_url() -> str:
    return os.getenv("ALEMBIC_DATABASE_URL") or obter_settings().database_url


config.set_main_option("sqlalchemy.url", obter_url())


def run_migrations_offline() -> None:
    context.configure(
        url=obter_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
