# AGENTS.md — OAuth2 Auth Service (FastAPI)

Guia para agentes de IA (e humanos) trabalhando neste repositório. Descreve a arquitetura, as
convenções e a referência completa de endpoints — leia antes de alterar código.

> Existe uma implementação irmã deste serviço em TypeScript/NestJS na branch `oauth2-nestjs` do
> mesmo repositório. Mesmo desenho de domínio, ferramentas diferentes; não misture convenções
> das duas ao portar código de uma para outra.

## O que este serviço faz

Microserviço central de autenticação **OAuth2 Client Credentials** para dois públicos:

- **RPAs**: credencial compartilhada (`app_rpa`) + um `rpa_id` que identifica qual RPA está
  executando. O `rpa_id` chega na requisição e **não é confiável** — só vira claim do token
  depois de confirmado no Vault (autorização) e no PostgreSQL (cadastro/status).
- **Microsserviços**: um `client_id`/`client_secret` por serviço, Client Credentials clássico.

Os consumidores validam os JWTs **localmente** via `/.well-known/jwks.json`; `POST
/oauth/introspect` é um mecanismo **opcional** de validação centralizada — o único jeito de ver
uma revogação que aconteceu depois da emissão do token, já que o JWT sozinho não mostra isso.

## Stack

Python 3.13 (gerenciado via **uv**, não pip/poetry) · FastAPI · SQLModel + SQLAlchemy async
(`asyncpg`) · Alembic · PostgreSQL 16 · HashiCorp Vault (KV v2, via `httpx.AsyncClient` — sem SDK
oficial) · `PyJWT` + `cryptography` para JWT RS256 · `argon2-cffi` para hash de secret · Ruff
(lint + format) · pytest + pytest-asyncio · Scalar UI para documentação (Swagger UI/ReDoc
desabilitados).

## Comandos essenciais

```bash
docker compose up -d              # Postgres + Vault (modo dev)
uv sync                           # instala dependências
uv run alembic upgrade head       # aplica as migrations
uv run python scripts/bootstrap.py    # cria a primeira chave, app_rpa, rpa_custeio
uv run uvicorn app.main:app --reload --app-dir src
uv run pytest                     # unitários + integração
uv run pytest tests/unit          # só unitários (sem Postgres)
uv run pytest -m integracao       # só integração (precisa do Postgres do compose)
uv run ruff check --fix . && uv run ruff format .
```

`docker compose down -v` remove os containers **e os dados** (Postgres e Vault voltam vazios —
nenhuma chave JWT, cliente ou RPA sobrevive).

## Estrutura

```
src/app/
├─ main.py               criar_app(): monta o FastAPI, registra handlers de erro, /scalar
├─ config/                Settings (pydantic-settings) + obter_settings()
├─ database/               engine e sessão async (SQLAlchemy)
├─ models/                 entidades SQLModel: Cliente, Rpa, ChaveJwt, enums
├─ repositories/            acesso ao Postgres por trás de Protocols — permite fakes nos testes
├─ security/
│  ├─ jwt_service.py        ServicoJwt: emite/valida JWT (PyJWT)
│  ├─ key_manager.py         GerenciadorChaves: ciclo de vida das chaves de assinatura
│  ├─ chaves.py               geração de par RSA + conversão para JWK
│  ├─ hashing.py               HasherSecret (argon2-cffi)
│  ├─ gerador_secret.py         client_secret/client_id
│  ├─ admin_auth.py             AutenticadorAdmin (Protocol) + implementações
│  └─ dependencias.py           requer_admin, obter_claims_do_token (dependências do FastAPI)
├─ vault/                  VaultClient (ABC), VaultHttpClient, FakeVaultClient
├─ services/                regras de negócio: ServicoToken, ServicoCliente, ServicoRpa, ServicoIntrospeccao
├─ schemas/                  Pydantic: contratos de entrada/saída dos routers
├─ routers/                   um arquivo por grupo de endpoints
└─ observability/             logging JSON, auditoria, redação de segredos, middleware de request_id
```

`dependencies.py` (raiz de `app/`) centraliza as dependências injetáveis do FastAPI (sessão,
repositórios, `GerenciadorChaves`, `ServicoJwt`, autenticador admin, services de token) — é o
equivalente aos módulos do Nest: ao adicionar um service novo, registre a dependência ali.

## Onde cada segredo mora

| Item | Lugar | Nunca em |
|---|---|---|
| `client_secret` | não persiste em lugar nenhum | banco, log |
| hash do `client_secret` | Postgres (`Cliente.client_secret_hash`) | resposta HTTP |
| chave **privada** de assinatura | Vault (`jwt/keys/{kid}`) | Postgres, `.env`, código |
| `kid`, chave pública, status | Postgres (`ChaveJwt`) | — |
| credenciais das RPAs | Vault (`rpa/{rpa_id}`) | Postgres |

A tabela `chaves_jwt` tem um índice único **parcial** (`WHERE status = 'ativa'`) garantindo no
máximo uma chave ativa — adicionado à mão na migration gerada pelo Alembic, porque o SQLModel
não expressa índices parciais diretamente. Se regenerar a migration via `alembic revision
--autogenerate`, esse índice some do diff; é preciso reintroduzi-lo manualmente (ver
`migrations/versions/*_cria_tabelas_*.py`, `op.create_index(..., postgresql_where=...)`).

## Convenção de nomes

Este projeto é **snake_case em tudo** — models, schemas Pydantic, JSON de request/response,
variáveis. Isso já bate naturalmente com os campos padronizados da RFC 6749/7662
(`grant_type`, `client_id`, `client_secret`, `access_token`, `token_type`, `expires_in`, `rpa_id`
incluso, já que é `snake_case` por convenção do próprio projeto, não por exigência da RFC — é
extensão nossa). Não introduza camelCase em lugar nenhum deste código; se for portar algo da
branch `oauth2-nestjs` (que é camelCase + snake_case só nos campos da RFC), converta para
snake_case puro aqui.

## Segurança de token: por que `algorithms=[chave.algoritmo]`

Em `ServicoJwt.validar` (`security/jwt_service.py`), o algoritmo passado ao `jwt.decode` do
PyJWT vem do **registro da chave no banco** (`ChaveJwt.algoritmo`), nunca do cabeçalho `alg` do
token recebido. Aceitar o `alg` do token abriria uma janela clássica de *algorithm confusion*
(assinar com HS256 usando a chave pública RSA como segredo simétrico). Há teste cobrindo isso
(`tests/unit/test_jwt_service.py::test_recusa_troca_de_algoritmo`) — não remova essa checagem
"para simplificar".

## Fluxo de validação do `POST /oauth/rpa/token` (ordem importa)

Em `ServicoToken.emitir_para_rpa` (`services/token_service.py`):

1. `client_id` + `client_secret` contra o hash no Postgres (`ServicoToken.autenticar_cliente`).
2. Cliente precisa ser `tipo=rpa` e `status=ativo`.
3. `vault.existe('rpa/{rpa_id}')` — se não existir, `400 invalid_request`. **Este é o ponto que
   torna o `rpa_id` da requisição não confiável por si só.**
4. RPA precisa existir no Postgres com `status=ativo`.
5. Só então o JWT é emitido, com `rpa_id` como claim.

Falha de credencial sempre responde `401 invalid_client` genérico (nunca revela se o
`client_id` existe) — mas o log estruturado grava o motivo real via `observability/auditoria.py`.
Uma mitigação de timing-oracle roda um hash fictício quando o `client_id` não existe, para que a
resposta leve o mesmo tempo de um secret errado (ver `_HASH_FICTICIO` em `token_service.py`).

## Autenticação administrativa e de RPA (dependências do FastAPI)

`security/dependencias.py` expõe:

- `requer_admin`: valida `Authorization: Bearer {ADMIN_TOKEN}` via `AutenticadorAdmin` (Protocol
  em `admin_auth.py`), injetado por `criar_autenticador_admin()` conforme `ADMIN_AUTH_MODE`
  (`static` hoje; `entraid` tem o esqueleto pronto mas falha explicitamente até ser
  homologado).
- `obter_claims_do_token`: valida o access token do próprio serviço (`Authorization: Bearer`) e
  devolve os claims — usado por `GET /oauth/rpas/{rpa_id}/credentials`.

Ambas são `Depends(...)` normais do FastAPI; não reimplemente a extração do header em cada
router.

## Referência de endpoints

Prefixo comum: nenhum (rotas montadas na raiz). Content-Type dos endpoints de
token/introspect é `application/x-www-form-urlencoded` (aceitam também `Authorization: Basic`
para as credenciais de cliente). Endpoints administrativos usam `Authorization: Bearer
{ADMIN_TOKEN}`.

| Método | Rota | Auth | Corpo / notas |
|---|---|---|---|
| `POST` | `/oauth/rpa/token` | client_id+secret (form ou Basic) | `grant_type=client_credentials`, `rpa_id`. Ver ordem de validação acima. |
| `POST` | `/oauth/service/token` | client_id+secret (form ou Basic) | `grant_type=client_credentials`. |
| `POST` | `/oauth/introspect` | client_id+secret (form ou Basic) | `token`. Resposta sempre 200; token inválido/revogado → `{"active": false}` (`response_model_exclude_none=True`). |
| `POST` | `/oauth/clients` | admin | Cria cliente. `client_secret` retornado **uma única vez**. 201. |
| `GET` | `/oauth/clients/{client_id}` | admin | Nunca retorna `client_secret_hash`. |
| `POST` | `/oauth/clients/{client_id}/rotate-secret` | admin | Novo secret, hash antigo sobrescrito. |
| `POST` | `/oauth/clients/{client_id}/revoke` | admin | Idempotente. |
| `POST` | `/oauth/rpas` | admin | Grava Postgres + Vault. 201. |
| `GET` | `/oauth/rpas/{rpa_id}` | admin | |
| `POST` | `/oauth/rpas/{rpa_id}/revoke` | admin | Idempotente; remove do Vault. |
| `GET` | `/oauth/rpas/{rpa_id}/credentials` | Bearer (token da própria RPA) | Exige `tipo=rpa` e `rpa_id` do token == da rota. |
| `GET` | `/.well-known/jwks.json` | pública | Servido do Postgres — não depende do Vault estar no ar. |
| `GET` | `/health` | pública | Checa Postgres e Vault; `degradado` se algum falhar. |
| `GET` | `/scalar` | pública | Documentação interativa (Swagger UI/ReDoc desabilitados). |
| `GET` | `/openapi.json` | pública | Schema OpenAPI cru. |

Erros de fluxo OAuth (subclasses de `ErroOAuth` em `services/erros.py`) respondem
`{"error": "...", "error_description": "..."}`. Erros administrativos (subclasses de
`ErroDeNegocio`) respondem `{"detail": "..."}`. Falhas de infraestrutura (Vault fora do ar, sem
chave ativa) respondem `503`. Os handlers ficam registrados em `main.py`.

## Rotação de chaves

```bash
uv run python scripts/rotacionar_chave.py              # gera nova chave ativa
uv run python scripts/rotacionar_chave.py --aposentar  # remove do JWKS as expiradas
```

A chave anterior continua publicada no JWKS por `KEY_ROTATION_GRACE_MINUTES` (35 por padrão,
folga sobre os 30 minutos de validade do token) antes de poder ser aposentada.

## Testes

Unitários (`tests/unit/`) usam repositórios fake (Protocols implementados em memória, ver
`tests/fakes.py`) e `FakeVaultClient` — nunca sobem Postgres real. Testes de integração
(`tests/integration/`, marcados `@pytest.mark.integracao`) usam o banco `oauth_test` do
`docker compose`, com as migrations do Alembic aplicadas por fixture de sessão; há um módulo
(`test_vault_http.py`) que exercita a integração real com o Vault, pulado automaticamente se ele
não estiver acessível.

Ao adicionar uma regra de negócio nova, siga o padrão já estabelecido em `tests/unit/conftest.py`
(fixtures `servico_token`, `cliente_repositorio`, `vault`, etc.) e cubra explicitamente o
caminho de erro (credencial inválida, recurso revogado, recurso não encontrado) — não só o
caminho feliz.

## Auditoria

Logs estruturados em JSON, uma linha por evento, direto no stdout — prontos para o Grafana Loki.
`observability/logging.py` define o `FormatadorJson` e o `FiltroRedacao`, que percorre
recursivamente os campos de cada registro (inclusive dentro de dicionários e listas aninhadas) e
substitui por `***` qualquer chave sensível (`client_secret`, `client_secret_hash`,
`access_token`, `refresh_token`, credenciais do Vault, chave privada, `authorization`). Nunca
passe um segredo como campo de log confiando só no filtro — prefira nunca colocá-lo no dicionário
de log.

Eventos nomeados (`observability/auditoria.py`): `autenticacao_sucesso`, `autenticacao_falha`,
`cliente_criado`, `rpa_criada`, `secret_rotacionado`, `acesso_revogado`, `credenciais_acessadas`,
`operacao_admin`, `introspeccao`, `chave_rotacionada`.
