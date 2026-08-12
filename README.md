# OAuth2 Auth Service

Microserviço central de autenticação **OAuth2 Client Credentials** para RPAs e microsserviços
internos. Emite JWTs assinados com chave assimétrica (RS256) que os consumidores validam
**localmente**, usando a chave pública publicada no JWKS.

## Os dois fluxos

| | RPAs | Microsserviços |
|---|---|---|
| Endpoint | `POST /oauth/rpa/token` | `POST /oauth/service/token` |
| Credencial | compartilhada (`app_rpa`) + `rpa_id` | um `client_id`/`client_secret` por serviço |
| Claim `tipo` | `rpa` | `service` |
| Validade | 30 minutos | 30 minutos |

O `rpa_id` chega pela requisição e **não é confiado por isso**. A ordem de validação é:

1. `client_id` + `client_secret` conferidos contra o hash Argon2id no PostgreSQL;
2. o cliente precisa ser do tipo `rpa` e estar `ativo`;
3. o `rpa_id` precisa existir em `rpa/{rpa_id}` no **Vault** — é essa presença que autoriza;
4. a RPA precisa estar cadastrada e `ativa` no PostgreSQL;
5. só então o token é emitido, com o `rpa_id` como claim.

## Onde cada segredo vive

| Item | Lugar | Observação |
|---|---|---|
| `client_secret` | lugar nenhum | só existe no instante da geração |
| hash do `client_secret` | PostgreSQL | Argon2id |
| chave **privada** de assinatura | Vault (`jwt/keys/{kid}`) | nunca no código, banco ou `.env` |
| `kid`, chave **pública**, status | PostgreSQL (`chaves_jwt`) | é daqui que sai o JWKS |
| credenciais das RPAs | Vault (`rpa/{rpa_id}`) | e a presença do caminho autoriza o `rpa_id` |

Manter os metadados da chave no banco deixa o JWKS de pé mesmo com o Vault indisponível e torna a
rotação uma transação SQL: a chave nova entra como `ativa` e a anterior vira `em_rotacao` de uma vez só.

## Subindo o ambiente

Requisitos: [uv](https://docs.astral.sh/uv/), Docker e Docker Compose.

```bash
docker compose up -d
```

Sobe PostgreSQL (com volume persistente e o banco `oauth_test` já criado) e o HashiCorp Vault em
modo dev. Depois:

```bash
cp .env.example .env
```

```bash
uv sync
```

```bash
uv run alembic upgrade head
```

```bash
uv run python scripts/bootstrap.py
```

O bootstrap é idempotente e cria a primeira chave de assinatura, o cliente `app_rpa`, um
microsserviço de exemplo e a `rpa_custeio` — imprimindo os `client_secret` **uma única vez**.

```bash
uv run uvicorn app.main:app --reload --app-dir src
```

Documentação em <http://localhost:8000/scalar> (Scalar UI; Swagger UI e ReDoc ficam desabilitados) e
o schema em <http://localhost:8000/openapi.json>.

Para derrubar tudo e apagar os dados:

```bash
docker compose down -v
```

## Endpoints

| Método | Rota | Autenticação |
|---|---|---|
| POST | `/oauth/rpa/token` | `client_id` + `client_secret` (formulário ou `Basic`) |
| POST | `/oauth/service/token` | `client_id` + `client_secret` (formulário ou `Basic`) |
| POST | `/oauth/introspect` | cliente autenticado |
| POST | `/oauth/clients` | administrativa |
| GET | `/oauth/clients/{client_id}` | administrativa |
| POST | `/oauth/clients/{client_id}/rotate-secret` | administrativa |
| POST | `/oauth/clients/{client_id}/revoke` | administrativa |
| POST | `/oauth/rpas` | administrativa |
| GET | `/oauth/rpas/{rpa_id}` | administrativa |
| POST | `/oauth/rpas/{rpa_id}/revoke` | administrativa |
| GET | `/oauth/rpas/{rpa_id}/credentials` | access token da própria RPA |
| GET | `/.well-known/jwks.json` | pública |
| GET | `/health` | pública |

### Exemplos

```bash
curl -s -X POST http://localhost:8000/oauth/rpa/token -d grant_type=client_credentials -d client_id=app_rpa -d client_secret=SEU_SECRET -d rpa_id=rpa_custeio
```

```bash
curl -s -X POST http://localhost:8000/oauth/clients -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"client_id":"svc_faturamento","nome":"Servico de Faturamento","tipo":"servico"}'
```

## Validando o token no microsserviço

O caminho normal é validar **localmente**, sem chamar este serviço:

```python
import jwt
import httpx

jwks = httpx.get("http://auth:8000/.well-known/jwks.json").json()  # cacheie por alguns minutos
chaves = {k["kid"]: jwt.PyJWK.from_dict(k) for k in jwks["keys"]}

kid = jwt.get_unverified_header(token)["kid"]
claims = jwt.decode(
    token,
    chaves[kid].key,
    algorithms=["RS256"],            # fixe o algoritmo; nunca use o "alg" do token
    issuer="https://auth.interno",
    audience="microservicos-internos",
)
```

`POST /oauth/introspect` existe como mecanismo **opcional** de validação centralizada. Ele acrescenta
o que o JWT sozinho não mostra: se o cliente ou a RPA foram revogados depois da emissão.

Esta primeira versão não implementa scopes. Decidir quais microsserviços podem chamar quais é
responsabilidade de cada microsserviço, a partir dos claims `sub`, `tipo` e `rpa_id`.

## Rotação de chaves

```bash
uv run python scripts/rotacionar_chave.py
```

A chave nova passa a assinar; a anterior continua no JWKS por `KEY_ROTATION_GRACE_MINUTES`
(35 por padrão, folga sobre os 30 minutos de validade do token). Passado esse prazo:

```bash
uv run python scripts/rotacionar_chave.py --aposentar
```

que tira a chave do JWKS e apaga a privada do Vault.

## Autenticação administrativa

Hoje: token fixo no `.env` (`ADMIN_AUTH_MODE=static`), comparado em tempo constante — **temporário,
para desenvolvimento e testes**.

A implementação definitiva é o Microsoft Entra ID. Routers e services dependem apenas do protocolo
`AutenticadorAdmin` e da `IdentidadeAdmin` que ele devolve, então a troca é substituir a classe
escolhida por `criar_autenticador_admin` em `src/app/security/admin_auth.py`, sem tocar em regra de
negócio. `AutenticadorAdminEntraId` já tem a estrutura e o passo a passo documentado; enquanto não
for homologado contra um tenant real, ele falha explicitamente em vez de aceitar credenciais sem
verificação.

## Auditoria

Logs estruturados em JSON, uma linha por evento, direto no stdout — prontos para o Grafana Loki.
Cada linha carrega `timestamp`, `nivel`, `logger`, `mensagem`, `request_id` e os campos do evento.

Eventos: `autenticacao_sucesso`, `autenticacao_falha`, `cliente_criado`, `rpa_criada`,
`secret_rotacionado`, `acesso_revogado`, `credenciais_acessadas`, `operacao_admin`, `introspeccao`,
`chave_rotacionada`.

Um filtro de redação percorre os campos de cada registro — inclusive dentro de dicionários e listas
aninhadas — e substitui por `***` qualquer chave sensível (`client_secret`, `client_secret_hash`,
`access_token`, `refresh_token`, credenciais do Vault, chave privada, `authorization`).

## Testes

```bash
uv run pytest
```

Unitários usam repositórios fake e um Vault em memória — não precisam de PostgreSQL. Os de
integração usam o banco `oauth_test` do compose, com as migrations do Alembic aplicadas por fixture,
e há um módulo que exercita a integração real com o Vault (pulado se ele não estiver no ar).

```bash
uv run pytest tests/unit
```

```bash
uv run pytest -m integracao
```

## Estrutura

```
src/app/
├─ routers/         HTTP e validação da requisição
├─ services/        regras de negócio
├─ repositories/    acesso ao PostgreSQL (+ protocolos, para os fakes)
├─ models/          entidades SQLModel
├─ schemas/         contratos de entrada e saída
├─ security/        JWT, chaves, hashing, autenticação administrativa
├─ vault/           integração com o cofre (abstração + HTTP + fake)
├─ observability/   logging JSON, redação, request_id
├─ config/          settings
└─ database/        engine e sessões
```

Os nomes de campo são em português; os termos padronizados do OAuth2 (`client_id`, `client_secret`,
`grant_type`, `access_token`, `jti`…) são preservados.

## Variáveis de ambiente

Veja `.env.example`. As principais:

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | PostgreSQL da aplicação |
| `TEST_DATABASE_URL` | banco usado pelos testes de integração |
| `VAULT_ADDR` / `VAULT_TOKEN` | acesso ao cofre |
| `VAULT_KV_MOUNT` / `VAULT_BASE_PATH` | mount KV v2 e prefixo dos segredos |
| `JWT_ISSUER` / `JWT_AUDIENCE` | claims `iss` e `aud` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | validade do token (30) |
| `KEY_ROTATION_GRACE_MINUTES` | quanto tempo a chave anterior fica no JWKS |
| `ADMIN_AUTH_MODE` | `static` ou `entraid` |
| `ADMIN_TOKEN` | credencial administrativa temporária |
