"""Contratos dos endpoints de gestão de clientes OAuth2."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import StatusAcesso, TipoCliente

PADRAO_IDENTIFICADOR = r"^[a-zA-Z0-9_\-]{3,120}$"


class ClienteCriacaoRequest(BaseModel):
    client_id: str | None = Field(
        default=None,
        pattern=PADRAO_IDENTIFICADOR,
        description="Identificador do cliente. Gerado automaticamente se omitido.",
        examples=["svc_faturamento"],
    )
    nome: str = Field(min_length=3, max_length=150, examples=["Serviço de Faturamento"])
    descricao: str | None = Field(default=None, max_length=500)
    tipo: TipoCliente = Field(
        default=TipoCliente.SERVICO,
        description="`servico` para microsserviços; `rpa` para a aplicação compartilhada das RPAs.",
    )


class ClienteResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    client_id: str
    nome: str
    descricao: str | None
    tipo: TipoCliente
    status: StatusAcesso
    criado_em: datetime
    atualizado_em: datetime
    secret_rotacionado_em: datetime | None
    revogado_em: datetime | None


class ClienteCriadoResposta(ClienteResposta):
    client_secret: str = Field(
        description="Exibido uma única vez. O serviço armazena apenas o hash.",
    )
    aviso: str = "Guarde o client_secret agora: ele não poderá ser consultado novamente."


class SecretRotacionadoResposta(BaseModel):
    client_id: str
    client_secret: str = Field(description="Novo secret. O anterior deixa de valer imediatamente.")
    secret_rotacionado_em: datetime
    aviso: str = "Guarde o client_secret agora: ele não poderá ser consultado novamente."
