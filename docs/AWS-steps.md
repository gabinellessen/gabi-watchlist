# AWS — Passo a passo do deploy

> Roteiro de provisionamento da infraestrutura AWS para a Watchlist 2026/1.
> Todo o deploy é feito pelo **console web** do Learner Lab; o build/push das
> imagens roda em **GitHub Actions**. Conta usada: `gabinellessen` / repo:
> `https://github.com/gabinellessen/gabi-watchlist`.

## Visão geral da arquitetura

```
Browser
   │
   ▼
[ API Gateway (regional, REST) ]   ◄── única porta pública
   │                       │
   │  /titles, /titles/{id}│ /report
   ▼                       ▼
[ ECS Fargate ]         [ Lambda Node 20 ]
  Backend FastAPI           "watchlist-report"
   │                            │
   ▼                            └─ fetch /titles/ via APIGW
[ RDS Postgres ]
  Subnet privada
  porta 5432 só p/ SG ECS

[ ECS Fargate ] Frontend Next.js 15 ─── chama API Gateway ───┘
  porta 3000
```

| Camada | Recurso AWS | Nome |
|---|---|---|
| Rede | VPC `10.0.0.0/16`, 2 subnets públicas + 2 privadas, IGW | `watchlist-vpc` |
| Banco | RDS PostgreSQL 15, subnet privada | `watchlist-db` |
| Imagens | 2 repositórios ECR | `gabi-watchlist-api`, `gabi-watchlist-front` |
| Compute | ECS Fargate cluster + 2 services | `watchlist-cluster` |
| Serverless | Lambda Node 20 | `watchlist-report` |
| Gateway | API Gateway REST, stage prod | `watchlist-gw` |

**Account ID:** `172560331362` · **Região:** `us-east-1` · **IAM role:** `LabRole` (já existe no Learner Lab).

---

## 0. Pré-requisitos

1. **Iniciar Learner Lab** em `awsacademy.instructure.com` → **Start Lab** → bolinha verde.
2. **AWS Details** → **AWS CLI** → **Show** → copiar as 3 linhas (`aws_access_key_id`, `aws_secret_access_key`, `aws_session_token`).
3. **GitHub Secrets** (Repo → Settings → Secrets and variables → Actions → New repository secret), criar:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_SESSION_TOKEN`
4. ⚠️ Credenciais EXPIRAM quando a sessão do Lab encerra (~4h). Sempre reatualizar os 3 secrets ao reabrir o lab.

---

## 1. VPC e Security Groups

### 1.1 VPC (wizard "VPC and more")

Console → **VPC** → **Create VPC** → selecionar **VPC and more**:

- Name tag auto-generation: `watchlist`
- IPv4 CIDR: `10.0.0.0/16`
- Number of AZs: **2**
- Number of public subnets: **2**
- Number of private subnets: **2**
- NAT gateways: **None**
- VPC endpoints: **None**

→ **Create VPC**.

O wizard cria automaticamente: VPC, 4 subnets, IGW, route tables associadas.

📸 `docs/screenshots/01-vpc.png` — resource map do VPC.

### 1.2 Security Groups

VPC → **Security Groups** → **Create security group**:

**`watchlist-ecs-sg`** (VPC = `watchlist-vpc`):
| Tipo | Porta | Origem |
|---|---|---|
| Custom TCP | 80 | `0.0.0.0/0` |
| Custom TCP | 3000 | `0.0.0.0/0` |

**`watchlist-rds-sg`** (VPC = `watchlist-vpc`):
| Tipo | Porta | Origem |
|---|---|---|
| PostgreSQL | 5432 | SG `watchlist-ecs-sg` |

📸 `docs/screenshots/03-security-groups.png` — lista dos 2 SGs.

Detalhes em `infra/vpc-config.md`.

---

## 2. RDS PostgreSQL

### 2.1 DB Subnet Group

Console → **RDS** → **Subnet groups** → **Create DB subnet group**:
- Name: `watchlist-db-subnet-group`
- VPC: `watchlist-vpc`
- AZs: `us-east-1a` + `us-east-1b`
- Subnets: as **2 privadas** (`watchlist-subnet-private1-*` e `private2-*`)

### 2.2 Instância

RDS → **Databases** → **Create database**:
- Engine: **PostgreSQL** (versão 15.x)
- Templates: **Free tier**
- DB instance identifier: `watchlist-db`
- Master username: `admin`
- Master password: gerar e **ANOTAR** (não commitar)
- Instance class: `db.t3.micro`
- Storage: 20 GB gp3
- **Connectivity:**
  - VPC: `watchlist-vpc`
  - Subnet group: `watchlist-db-subnet-group`
  - **Public access: No**
  - VPC security group: **Choose existing** → `watchlist-rds-sg` (remover o default)
- **Additional configuration:**
  - Initial database name: `watchlist`
- **Create database** → aguardar ~5min até **Available**.

### 2.3 Anotar endpoint

RDS → `watchlist-db` → **Connectivity & security** → copiar **Endpoint** (`watchlist-db.xxx.us-east-1.rds.amazonaws.com`) — vai entrar como `DB_HOST` na task definition.

📸 `docs/screenshots/04-rds.png` — página de detalhes mostrando "Publicly accessible: No".

Detalhes em `infra/rds-config.md`.

---

## 3. ECR — Repositórios de imagens

Console → **ECR** → **Private registry → Repositories** → **Create repository** (criar 2):

| Repo name | Tag immutability | Image scan |
|---|---|---|
| `gabi-watchlist-api` | disabled | disabled (opcional) |
| `gabi-watchlist-front` | disabled | disabled (opcional) |

Os URIs ficam:
- `172560331362.dkr.ecr.us-east-1.amazonaws.com/gabi-watchlist-api`
- `172560331362.dkr.ecr.us-east-1.amazonaws.com/gabi-watchlist-front`

📸 `docs/screenshots/05-ecr.png`.

---

## 4. Build da imagem do backend (CI/CD)

Repo no GitHub → aba **Actions** → workflow **Deploy Backend (build & push ECR)** → **Run workflow** → branch `main` → **Run**.

Acompanhar logs até `Imagem enviada:`. O workflow:
1. Faz checkout
2. Autentica via secrets AWS
3. `docker build` em `src/backend/`
4. `docker push` pro ECR (`:latest` e `:<sha>`)

Validação: ECR → `gabi-watchlist-api` → deve aparecer 2 tags.

> Se falhar com "expired token", as credenciais do Lab expiraram — reabrir o Lab e re-setar os 3 secrets.

---

## 5. ECS — Cluster e Backend Service

### 5.1 Cluster

Console → **ECS** → **Clusters** → **Create cluster**:
- Cluster name: `watchlist-cluster`
- Infrastructure: **AWS Fargate (serverless)**

### 5.2 Task Definition `watchlist-api-task`

ECS → **Task definitions** → **Create new task definition with JSON** → colar `infra/task-definition-api.json` (substituir `<DB_HOST>` e `<DB_PASSWORD>` antes; este arquivo não contém a senha real).

Configurações relevantes:
- Family: `watchlist-api-task`
- Launch type: FARGATE, awsvpc, 256 CPU / 512 MEM
- Execution & task role: `arn:aws:iam::172560331362:role/LabRole`
- Container `watchlist-api`, image `172560331362.dkr.ecr.us-east-1.amazonaws.com/gabi-watchlist-api:latest`, port 80
- Env vars: `DB_HOST`, `DB_PORT=5432`, `DB_USER=admin`, `DB_PASSWORD=<senha>`, `DB_NAME=watchlist`
- Log group `/ecs/watchlist-api` (criar automaticamente)

### 5.3 Service `watchlist-api-service`

Cluster `watchlist-cluster` → **Services** → **Create**:
- Launch type: FARGATE
- Task definition: `watchlist-api-task` (rev. 1)
- Service name: `watchlist-api-service`
- Desired tasks: **1**
- Networking:
  - VPC: `watchlist-vpc`
  - Subnets: as **2 públicas**
  - Security group: `watchlist-ecs-sg`
  - Public IP: **Enabled**

### 5.4 Validar

ECS → cluster → task ativa → **Public IP** → testar:
```bash
curl http://<API_PUBLIC_IP>/
curl http://<API_PUBLIC_IP>/titles/   # deve retornar 12 títulos do seed
```

📸 `docs/screenshots/06-ecs-api.png` — task ativa.

> Se a task falhar: ECS → task → aba **Logs** (CloudWatch) → procurar erro de DB (provavelmente env vars ou SG do RDS).

---

## 6. Lambda `/report`

Console → **Lambda** → **Create function**:
- Function name: `watchlist-report`
- Runtime: **Node.js 20.x**
- Architecture: x86_64
- Execution role: **Use an existing role** → `LabRole`

Aba **Code** → colar o conteúdo de `src/lambda/index.mjs` no editor (arquivo `index.mjs`).
**Runtime settings** → handler = `index.handler`.
**Deploy**.

**Configuration → Environment variables** → adicionar:
- `API_GATEWAY_URL` = `https://placeholder.invalid` (provisório; trocaremos no passo 7)

📸 `docs/screenshots/07-lambda.png`.

---

## 7. API Gateway

### 7.1 Criar API REST

Console → **API Gateway** → **Create API** → **REST API → Build**:
- API name: `watchlist-gw`
- Endpoint Type: **Regional**

### 7.2 Recursos e métodos

**`/titles`** (Create Resource em root):
- Method **ANY** → integration type **HTTP Proxy** → URL `http://<API_PUBLIC_IP>:80/titles/`

**`/titles/{id}`** (Create Resource em `/titles`, nome `id`, path `{id}`):
- Method **ANY** → integration type **HTTP Proxy** → URL `http://<API_PUBLIC_IP>:80/titles/{id}`

**`/report`** (Create Resource em root):
- Method **GET** → integration type **Lambda Function** → ✅ **Use Lambda Proxy integration** → Function `watchlist-report`

### 7.3 Enable CORS

Para cada resource (`/titles`, `/titles/{id}`, `/report`):
**Actions → Enable CORS → Enable CORS and replace existing CORS headers**.

### 7.4 Deploy

**Actions → Deploy API**:
- Stage: **[New Stage]** → `prod`
- Deploy

→ copiar **Invoke URL**: `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod` (`APIGW`).

### 7.5 Atualizar env da Lambda

Lambda `watchlist-report` → Configuration → Environment variables → `API_GATEWAY_URL` = a Invoke URL acima → Save.

### 7.6 Validar

```bash
APIGW=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
curl $APIGW/titles/
curl $APIGW/titles/1
curl $APIGW/report
```

Todos devem responder JSON válido. Em particular, `/report` deve agora retornar estatísticas (Lambda → APIGW → ECS → RDS → volta).

📸 `docs/screenshots/08-api-gateway.png`.

---

## 8. Build do frontend (com URL do API Gateway)

### 8.1 Secret no GitHub

Repo → Settings → Secrets → **New repository secret**:
- Name: `NEXT_PUBLIC_API_BASE_URL`
- Value: `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod`

### 8.2 Rodar workflow do front

GitHub Actions → **Deploy Frontend (build & push ECR)** → **Run workflow** → `main` → **Run**.

Esperado: imagem `gabi-watchlist-front:latest` aparece no ECR.

---

## 9. ECS — Frontend Service

### 9.1 Task Definition `watchlist-front-task`

Colar `infra/task-definition-front.json` (arquivo no repo). Resumo:
- Family: `watchlist-front-task`, 256 CPU / 512 MEM
- LabRole para execução e task
- Container `watchlist-front`, image `172560331362.dkr.ecr.us-east-1.amazonaws.com/gabi-watchlist-front:latest`, port 3000
- Log group `/ecs/watchlist-front`

### 9.2 Service `watchlist-front-service`

Mesmo padrão do backend, mas:
- Task definition: `watchlist-front-task`
- Service name: `watchlist-front-service`
- Public IP: Enabled

### 9.3 Validar app E2E

Abrir `http://<FRONT_PUBLIC_IP>:3000`:
- `/` lista 12 títulos
- `/new` cria
- `/titles/[id]` edita / exclui
- `/report` mostra dashboard (alimentado pela Lambda via APIGW)

Validar no Network do browser que **todas** as chamadas vão pra `xxxxx.execute-api...`.

📸 `docs/screenshots/09-app-list.png`, `10-app-report.png`.

---

## 10. Atualizações pós-deploy

### Re-deployar backend após alterar código

1. Push em `main` toca em `src/backend/**` → workflow `Deploy Backend` roda → nova imagem `:latest` no ECR.
2. Console → ECS → `watchlist-api-service` → **Update service** → marcar **Force new deployment** → Update.

### Re-deployar frontend após alterar API URL ou código

1. Push em `main` toca em `src/frontend/**` (ou trocar secret `NEXT_PUBLIC_API_BASE_URL` e rodar manual) → workflow `Deploy Frontend` roda.
2. ECS → `watchlist-front-service` → **Update service** → **Force new deployment**.

### IP da task ECS mudou (task reiniciou)?

Atualizar as integrações HTTP Proxy do `/titles` e `/titles/{id}` no API Gateway com o novo IP → Deploy API → stage `prod`.

---

## 11. Solução de problemas comuns

| Sintoma | Causa | Como resolver |
|---|---|---|
| Workflow CI/CD falha com "ExpiredToken" | Credenciais do Lab expiraram | Reabrir Lab → re-setar os 3 secrets |
| ECS task fica em `STOPPED` | Imagem indisponível ou crash na startup | CloudWatch logs do `/ecs/watchlist-api` → ler erro |
| Backend não conecta no RDS | SG do RDS sem regra do SG do ECS, ou env DB_* errado | Conferir `watchlist-rds-sg` inbound 5432 com source = `watchlist-ecs-sg` |
| `/report` no APIGW retorna 502 | Lambda timeout ou `API_GATEWAY_URL` errada | Lambda → Configuration → Environment → conferir URL |
| Front mostra a URL antiga do APIGW | Build com env stale | Re-rodar `Deploy Frontend` (build-arg é assado no build) e Force new deployment |

---

## 12. Checklist da entrega

- [ ] VPC + subnets privada para o RDS
- [ ] RDS Postgres com `Publicly accessible: No`
- [ ] Imagens nos 2 repos ECR
- [ ] ECS cluster + 2 services rodando (backend e front)
- [ ] Lambda `watchlist-report` deployada
- [ ] API Gateway com `/titles`, `/titles/{id}` (HTTP Proxy) e `/report` (Lambda Proxy)
- [ ] App carrega em `http://<FRONT_IP>:3000` consumindo o APIGW
- [ ] Screenshots de cada serviço em `docs/screenshots/`
- [ ] `docs/relatorio.pdf` (≤12 pg) com diagrama e capturas
- [ ] Vídeo (≤5min, não-listado) com link no README
- [ ] ZIP no Moodle até 2026-05-29
