# AGENTS.md — OAuth2 Auth Service (NestJS)

Guia para agentes de IA (e humanos) trabalhando neste repositório. Descreve a arquitetura, as
convenções e a referência completa de endpoints — leia antes de alterar código.

> Existe uma implementação irmã deste serviço em Python/FastAPI na branch `oauth2-fastapi` do
> mesmo repositório. Mesmo desenho de domínio, ferramentas diferentes; não misture convenções
> das duas ao portar código de uma para outra.

## O que este serviço faz

Microserviço central de autenticação **OAuth2 Client Credentials** para dois públicos:

- **RPAs**: credencial compartilhada (`app_rpa`) + um `rpaId` que identifica qual RPA está
  executando. O `rpaId` chega na requisição e **não é confiável** — só vira claim do token
  depois de confirmado no Vault (autorização) e no PostgreSQL (cadastro/status).
- **Microsserviços**: um `client_id`/`client_secret` por serviço, Client Credentials clássico.

Os consumidores validam os JWTs **localmente** via `/.well-known/jwks.json`; `POST
/oauth/introspect` é um mecanismo **opcional** de validação centralizada — o único jeito de ver
uma revogação que aconteceu depois da emissão do token, já que o JWT sozinho não mostra isso.

## Stack

Node 22 · pnpm · TypeScript (`module: nodenext`, mas o projeto é **CommonJS** — sem `"type":
"module"` no `package.json`) · NestJS 11 · Prisma 7 (driver adapter `@prisma/adapter-pg`, **sem**
repository pattern — os services injetam `PrismaService` direto) · PostgreSQL 16 · HashiCorp
Vault (KV v2, via `@nestjs/axios`) · `jose` para JWT RS256 (não `@nestjs/jwt`) · `argon2` para
hash de secret · Biome (lint + format, não ESLint/Prettier) · Vitest (não Jest).

## Comandos essenciais

```bash
docker compose up -d              # Postgres + Vault (modo dev)
pnpm install                      # dispara `prisma generate` via postinstall
pnpm run prisma:migrate           # aplica as migrations
pnpm run start:dev                # nest start --watch
pnpm run build && node dist/main.js   # build de produção
pnpm test                         # unitários (Vitest)
pnpm run test:e2e                 # e2e contra o Postgres do compose
pnpm run lint                     # biome check --write .
```

`docker compose down -v` remove os containers **e os dados** (Postgres e Vault voltam vazios —
nenhuma chave JWT, cliente ou RPA sobrevive).

## Estrutura

```
src/
├─ main.ts                 bootstrap, ValidationPipe global, filtros de exceção
├─ app.module.ts            módulo raiz — todo módulo novo entra aqui
├─ config/                  AppConfigService (fachada tipada sobre ConfigService) + validação Joi
├─ common/
│  ├─ domain/status.enums.ts   StatusAcesso, TipoCliente, StatusChave (string, não enum Postgres)
│  ├─ errors/                  ErroOAuth (RFC 6749) e ErroDeNegocio ({"detail":...}) — ver abaixo
│  ├─ filters/                  um filtro por família de erro, mais o catch-all
│  ├─ guards/                   AdminAuthGuard, TokenAuthGuard
│  ├─ decorators/                @AdminIdentity(), @ClaimsTokenParam()
│  ├─ dto/                       PADRAO_IDENTIFICADOR, resolverCredenciaisCliente, TokenRespostaDto
│  └─ logging/                   JsonLoggerService, AuditLogService, redação de segredos
├─ prisma/                  PrismaService (driver adapter, ver "Prisma 7" abaixo)
├─ vault/                   VaultService (classe abstrata = token de DI), VaultHttpService, VaultFakeService
└─ modules/
   ├─ chaves-jwt/           KeyManagerService — ciclo de vida das chaves de assinatura
   ├─ token-service/        TokenService — emite/valida JWT (jose)
   ├─ hashing/              HashingService (argon2), SecretGeneratorService
   ├─ admin-auth/           IAutenticadorAdmin + implementações (estática / Entra ID)
   ├─ clientes/             CRUD de clientes OAuth2 + autenticarCliente (compartilhado)
   ├─ rpas/                 CRUD de RPAs + acesso às próprias credenciais
   ├─ oauth-rpa/            POST /oauth/rpa/token
   ├─ oauth-service/        POST /oauth/service/token
   ├─ introspeccao/         POST /oauth/introspect
   ├─ jwks/                 GET /.well-known/jwks.json
   └─ health/               GET /health
```

Cada módulo de domínio tem um `index.ts` barrel — importe de lá (`from '../clientes'`), não dos
arquivos internos, exceto quando o próprio módulo é o autor do arquivo.

## Onde cada segredo mora

| Item | Lugar | Nunca em |
|---|---|---|
| `client_secret` | não persiste em lugar nenhum | banco, log |
| hash do `client_secret` | Postgres (`Cliente.clientSecretHash`) | resposta HTTP |
| chave **privada** de assinatura | Vault (`jwt/keys/{kid}`) | Postgres, `.env`, código |
| `kid`, chave pública, status | Postgres (`ChaveJwt`) | — |
| credenciais das RPAs | Vault (`rpa/{rpaId}`) | Postgres |

A tabela `chaves_jwt` tem um índice único **parcial** (`WHERE status = 'ativa'`) garantindo no
máximo uma chave ativa — adicionado à mão na migration, porque o Prisma não expressa índices
parciais no `schema.prisma`. Se regerar a migration a partir do schema, esse índice some; é
preciso reintroduzi-lo manualmente (ver `prisma/migrations/*/migration.sql`).

## Convenção de nomes: quando é `camelCase` e quando é `snake_case`

O projeto é camelCase por padrão (idiomático em TS/Nest), com duas exceções deliberadas:

- **Campos mandados pela RFC 6749/7662** ficam em `snake_case` nos DTOs de request/response de
  wire: `grant_type`, `client_id`, `client_secret`, `access_token`, `token_type`, `expires_in`,
  e os campos de introspection (`active`, `sub`, `iss`, `aud`, `iat`, `exp`, `jti`,
  `token_type`). Um cliente OAuth2 real espera esses nomes exatos.
- **Tudo o mais** é camelCase, inclusive a extensão proprietária `rpaId` (não é um campo da
  RFC — é nosso) tanto no corpo do formulário do `/oauth/rpa/token` quanto nas respostas.

Não "corrija" um desses para bater com o outro — é intencional.

## Prisma 7 — coisas que não são óbvias

- `datasource.url` **não existe mais** no `schema.prisma` (removido no Prisma 7). O
  `PrismaService` monta a conexão em runtime com `@prisma/adapter-pg`, usando a URL do
  `AppConfigService`. `prisma.config.ts` só serve para a **CLI** (migrate, studio).
- O gerador `prisma-client` decide ESM vs CJS a partir do `tsconfig` quando `moduleFormat` não
  é fixado, e escolhe ESM com `moduleResolution: nodenext` mesmo sem `"type": "module"` no
  `package.json` — quebra em runtime (`import.meta.url` sob CommonJS). Por isso o schema fixa
  `moduleFormat = "cjs"` explicitamente no bloco `generator client`. Não remova essa linha.
- O client é gerado para `src/generated/prisma` (não `node_modules/.prisma`), de propósito:
  mantém tudo sob `rootDir: ./src` do `tsconfig.build.json`, para que o build produza
  `dist/main.js` em vez de `dist/src/main.js`. Está gitignored; `pnpm install` o regenera via
  `postinstall`.
- Se `dist/` aparecer vazio depois de um build sem erros, apague `*.tsbuildinfo` — um cache
  incremental órfão de um `rootDir`/`outDir` anterior faz o `tsc` sair com código 0 sem emitir
  nada.

## NestJS — duas pegadinhas reais

1. **`app.useGlobalFilters(...)` inverte a lista internamente** antes de escolher o primeiro
   filtro cujo `@Catch()` casa com a exceção. Um catch-all (`@Catch()` sem argumentos) tem que
   ser passado **primeiro** na chamada para acabar avaliado por último — o comentário em
   `main.ts` explica isso. Se adicionar um novo filtro específico, registre-o **depois** do
   catch-all na lista de argumentos.
2. **`@Post()` sem `@HttpCode()` responde `201` por padrão.** Qualquer endpoint de ação que não
   seja criação de recurso (token, introspect, rotate-secret, revoke) precisa de
   `@HttpCode(HttpStatus.OK)` explícito, senão viola a RFC (que exige 200 no token endpoint) em
   silêncio — o corpo da resposta fica certo, só o status HTTP erra.
3. **Nunca troque `import { Classe }` por `import type { Classe }`** para uma classe usada como
   dependência de construtor sem `@Inject()` explícito — quebra a resolução de DI porque
   `emitDecoratorMetadata` perde a referência em runtime. A regra `useImportType` do Biome está
   desligada de propósito em `biome.json`; não reative.
4. **`VaultService` e `IAutenticadorAdmin` são classes abstratas**, não interfaces — servem de
   token de DI (`provide: VaultService`). Uma interface pura do TypeScript não existe em
   runtime e não pode ser usada como token.

## Fluxo de validação do `POST /oauth/rpa/token` (ordem importa)

Em `OauthRpaService.emitirToken` → `garantirRpaAutorizada`:

1. `client_id` + `client_secret` contra o hash no Postgres (`ClientesService.autenticarCliente`).
2. Cliente precisa ser `tipo=rpa` e `status=ativo`.
3. `vault.existe('rpa/{rpaId}')` — se não existir, `400 invalid_request`. **Este é o ponto que
   torna o `rpaId` da requisição não confiável por si só.**
4. RPA precisa existir no Postgres com `status=ativo`.
5. Só então o JWT é emitido, com `rpaId` como claim.

Falha de credencial sempre responde `401 invalid_client` genérico (nunca revela se o
`client_id` existe) — mas o log estruturado grava o motivo real via `AuditLogService`.

## Segurança de token: por que `algorithms: [chave.algoritmo]`

Em `TokenService.validar`, o algoritmo passado ao `jwtVerify` do `jose` vem do **registro da
chave no banco** (`ChaveJwt.algoritmo`), nunca do cabeçalho `alg` do token recebido. Aceitar o
`alg` do token abriria uma janela clássica de *algorithm confusion* (assinar com HS256 usando a
chave pública RSA como segredo simétrico). Há teste cobrindo isso
(`token.service.spec.ts`) — não remova essa checagem "para simplificar".

## Referência de endpoints

Prefixo comum: nenhum (rotas montadas na raiz). Content-Type dos endpoints de token/introspect é
`application/x-www-form-urlencoded` (aceitam também `Authorization: Basic` para as credenciais
de cliente). Endpoints administrativos usam `Authorization: Bearer {ADMIN_TOKEN}`.

| Método | Rota | Auth | Corpo / notas |
|---|---|---|---|
| `POST` | `/oauth/rpa/token` | client_id+secret (form ou Basic) | `grant_type=client_credentials`, `rpaId`. Ver ordem de validação acima. Resposta 200. |
| `POST` | `/oauth/service/token` | client_id+secret (form ou Basic) | `grant_type=client_credentials`. Resposta 200. |
| `POST` | `/oauth/introspect` | client_id+secret (form ou Basic) | `token`. Resposta sempre 200; token inválido/revogado → `{"active": false}`. |
| `POST` | `/oauth/clients` | admin | Cria cliente. `client_secret` retornado **uma única vez**. 201. |
| `GET` | `/oauth/clients/:clientId` | admin | Nunca retorna `clientSecretHash`. |
| `POST` | `/oauth/clients/:clientId/rotate-secret` | admin | Novo secret, hash antigo sobrescrito. 200. |
| `POST` | `/oauth/clients/:clientId/revoke` | admin | Idempotente. 200. |
| `POST` | `/oauth/rpas` | admin | Grava Postgres + Vault. 201. |
| `GET` | `/oauth/rpas/:rpaId` | admin | |
| `POST` | `/oauth/rpas/:rpaId/revoke` | admin | Idempotente; remove do Vault. 200. |
| `GET` | `/oauth/rpas/:rpaId/credentials` | Bearer (token da própria RPA) | Exige `tipo=rpa` e `rpaId` do token == da rota. |
| `GET` | `/.well-known/jwks.json` | pública | Servido do Postgres — não depende do Vault estar no ar. |
| `GET` | `/health` | pública | Checa Postgres e Vault; `degradado` se algum falhar. |
| `GET` | `/scalar` | pública | Documentação interativa (Swagger UI/ReDoc desabilitados). |
| `GET` | `/openapi.json` | pública | Schema OpenAPI cru. |

Erros de fluxo OAuth (`ErroOAuth` e subclasses) respondem `{"error": "...", "error_description":
"..."}`. Erros administrativos (`ErroDeNegocio` e subclasses) respondem `{"detail": "..."}`.
Falhas de infraestrutura (Vault fora do ar, sem chave ativa) respondem `503`.

## Testes

Unitários (`*.spec.ts` ao lado do arquivo testado) usam `vitest-mock-extended` para
`PrismaService`/serviços injetados e `VaultFakeService` (real, em memória) para o Vault — nunca
sobem Postgres real. Testes e2e (`test/e2e/*.e2e-spec.ts`, ainda a implementar) usam o Postgres
do `docker compose` com as migrations aplicadas via fixture.

Ao adicionar uma regra de negócio nova, siga o padrão já estabelecido: um `describe` por
service, helpers `criarAmbiente()`/`criarX()` no topo do arquivo para montar os fakes, e cubra
explicitamente o caminho de erro (credencial inválida, recurso revogado, recurso não
encontrado) — não só o caminho feliz.

## Auditoria

Nunca logar `client_secret`, `clientSecretHash`, `accessToken`, `refreshToken`, credenciais do
Vault ou chave privada — o `JsonLoggerService` redige recursivamente qualquer campo cujo nome
contenha um desses termos (ver `src/common/logging/redaction.ts`), mas isso não é desculpa para
passar segredos como `extra` de log por preguiça: prefira nunca colocá-los no objeto de log.
