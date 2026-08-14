// Sem `dotenv`: o Bun já carrega o `.env` automaticamente para qualquer
// script rodado via `bun run` (inclusive os que invocam o CLI do Prisma).
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
