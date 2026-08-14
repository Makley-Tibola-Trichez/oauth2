/**
 * Cliente Prisma compartilhado pela aplicação (singleton).
 *
 * A partir do Prisma 7 a URL de conexão não vem mais do `schema.prisma`
 * (`datasource.url` foi removido) — o client precisa de um driver adapter
 * explícito, montado aqui a partir da config da aplicação.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({ adapter });
