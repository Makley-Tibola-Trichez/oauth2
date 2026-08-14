-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret_hash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "secret_rotacionado_em" TIMESTAMPTZ(3),
    "revogado_em" TIMESTAMPTZ(3),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpas" (
    "id" TEXT NOT NULL,
    "rpa_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "revogado_em" TIMESTAMPTZ(3),

    CONSTRAINT "rpas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chaves_jwt" (
    "kid" TEXT NOT NULL,
    "chave_publica_pem" TEXT NOT NULL,
    "algoritmo" TEXT NOT NULL DEFAULT 'RS256',
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3),

    CONSTRAINT "chaves_jwt_pkey" PRIMARY KEY ("kid")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_client_id_key" ON "clientes"("client_id");

-- CreateIndex
CREATE INDEX "clientes_status_idx" ON "clientes"("status");

-- CreateIndex
CREATE INDEX "clientes_tipo_idx" ON "clientes"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "rpas_rpa_id_key" ON "rpas"("rpa_id");

-- CreateIndex
CREATE INDEX "rpas_status_idx" ON "rpas"("status");

-- CreateIndex
CREATE INDEX "chaves_jwt_status_idx" ON "chaves_jwt"("status");

-- CreateIndex
-- Garante, no banco, que existe no máximo uma chave assinando por vez.
-- O Prisma não expressa índices parciais no schema.prisma; adicionado à mão.
CREATE UNIQUE INDEX "chaves_jwt_unica_ativa" ON "chaves_jwt"("status") WHERE "status" = 'ativa';
