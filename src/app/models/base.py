"""Utilitários compartilhados pelos models."""

from __future__ import annotations

from datetime import UTC, datetime


def agora_utc() -> datetime:
    """Instante atual sempre com timezone, para colunas ``timestamptz``."""
    return datetime.now(UTC)
