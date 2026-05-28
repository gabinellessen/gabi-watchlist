# AWS — Passo a passo do deploy

> Roteiro de provisionamento da infra AWS da Watchlist 2026/1, feito pelo **console web** do Learner Lab.
> Conta: `gabinellessen` · Repo: `https://github.com/gabinellessen/gabi-watchlist`.
>
> ⚠️ **Importante:** o ECS está **bloqueado** neste Learner Lab (o role `voclabs` não tem
> permissão `ecs:*` — confirmado: `ListClusters`/`DescribeClusters`/`CreateCluster` retornam
> AccessDenied). Por isso o back-end e o front-end rodam em **EC2 + Docker** (alternativa
> permitida pelo enunciado, mesmos 40 pts de infra). EC2, RDS, Lambda, API Gateway e ECR estão liberados.

## Visão geral da arquitetura

```
Browser
   │
   ▼
[ API Gateway (regional, REST) ]   ◄── única porta pública
   │                       │
   │  /titles, /titles/{id}│ /report
   ▼                       ▼
[ EC2 + Docker ]        [ Lambda Node 20 ]
  container backend         "watchlist-report"
  FastAPI (porta 80)            │
   │                            └─ fetch /titles/ via APIGW
   ▼
[ RDS Postgres ]  subnet privada, porta 5432 só p/ SG do EC2

[ EC2 + Docker ] container frontend Next.js 15 (porta 3000) ── chama API Gateway ──┘
```

| Camada | Recurso AWS | Nome / ID |
|---|---|---|
| Rede | VPC `10.0.0.0/16`, 2 subnets públicas + 2 privadas, IGW | `watchlist-vpc` (`vpc-0005aeb8c7c11b896`) |
| Banco | RDS PostgreSQL 15, subnet privada | `watchlist-db` |
| Compute | 1 instância EC2 rodando 2 containers Docker | `watchlist-server` |
| Serverless | Lambda Node 20 | `watchlist-report` |
| Gateway | API Gateway REST, stage `prod` | `watchlist-gw` |

**Account ID:** `172560331362` · **Região:** `us-east-1` · **Key pair:** `vockey` · **Instance profile:** `LabInstanceProfile`.

---

## 0. Pré-requisitos

1. **Iniciar Learner Lab** em `awsacademy.instructure.com` → **Start Lab** → bolinha verde.
2. As credenciais (AWS Details → AWS CLI) **expiram** a cada sessão (~4h). Reabrir o Lab = pegar credenciais novas.
3. *(Opcional — só se for usar o CI/CD do ECR, que NÃO é necessário pro deploy em EC2)*: configurar os GitHub Secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`.

---

## 1. VPC e Security Groups ✅ (feito)

### 1.1 VPC (wizard "VPC and more")

Console → **VPC** → **Create VPC** → **VPC and more**:
- Name tag: `watchlist` · IPv4 CIDR: `10.0.0.0/16`
- 2 AZs · 2 subnets públicas · 2 subnets privadas
- NAT gateways: **None** · VPC endpoints: **None**

📸 `docs/screenshots/01-vpc.png`.

### 1.2 Security Groups

**`watchlist-ecs-sg`** (containers da EC2):
| Tipo | Porta | Origem |
|---|---|---|
| Custom TCP | 80 | `0.0.0.0/0` (backend) |
| Custom TCP | 3000 | `0.0.0.0/0` (frontend) |
| **SSH** | **22** | **Meu IP** (pra conectar na EC2) ← **adicionar** |

**`watchlist-rds-sg`** (RDS):
| Tipo | Porta | Origem |
|---|---|---|
| PostgreSQL | 5432 | SG `watchlist-ecs-sg` |

📸 `docs/screenshots/03-security-groups.png`. Detalhes em `infra/vpc-config.md`.

> ⚠️ **Pendente amanhã:** adicionar a regra **SSH (22)** ao `watchlist-ecs-sg` (não existia ainda).

---

## 2. RDS PostgreSQL ✅ (feito)

- DB Subnet Group `watchlist-db-subnet-group` (2 subnets privadas)
- Instância `watchlist-db`: PostgreSQL 15.x, **Dev/Test**, `db.t3.micro`, 20 GB gp3
- Usuário `postgres` · senha guardada fora do repo
- **Acesso público: Não** · SG `watchlist-rds-sg`
- Banco inicial `watchlist`
- **Criptografia desabilitada** (LabRole sem acesso à KMS `aws/rds`)
- **Endpoint:** `watchlist-db.czjhbkmwbqxm.us-east-1.rds.amazonaws.com`

📸 `docs/screenshots/04-rds.png`. Detalhes em `infra/rds-config.md`.

> Não precisa criar tabela nem rodar SQL: o backend cria a tabela `title` e popula 12 títulos no startup.

---

## 3. EC2 — criar a instância

Console → **EC2** → **Instâncias** → **Executar instâncias**:

| Campo | Valor |
|---|---|
| Nome | `watchlist-server` |
| AMI | **Amazon Linux 2023** |
| Tipo de instância | **t3.medium** (o build do Next.js precisa de RAM; t3.micro pode dar OOM) |
| Par de chaves | **`vockey`** |
| **Rede (Editar):** VPC | `watchlist-vpc` |
| Sub-rede | uma das **públicas** (`watchlist-subnet-public1-*`) |
| Atribuir IP público automaticamente | **Ativar** |
| Firewall (grupo de segurança) | **Selecionar existente** → `watchlist-ecs-sg` |
| **Detalhes avançados → Perfil de instância IAM** | `LabInstanceProfile` (opcional) |
| Armazenamento | 20 GB gp3 |

→ **Executar instância** → esperar ficar **Em execução** + status checks ✅.

Anotar o **IP público** (`<IP_EC2>`). 📸 `docs/screenshots/06-ec2.png`.

---

## 4. Conectar e instalar Docker + git

EC2 → instância → **Conectar** → aba **EC2 Instance Connect** → **Conectar** (terminal no navegador).

```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# plugin do docker compose
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# aplicar o grupo docker sem precisar relogar
newgrp docker
docker --version && docker compose version
```

---

## 5. Subir o backend (container)

Ainda na EC2:

```bash
git clone https://github.com/gabinellessen/gabi-watchlist.git
cd gabi-watchlist

export DB_HOST=watchlist-db.czjhbkmwbqxm.us-east-1.rds.amazonaws.com
export DB_PASSWORD='<senha-do-rds>'

docker compose -f docker-compose.prod.yml up -d --build api
```

Validar (na própria EC2):
```bash
curl http://localhost/
curl http://localhost/titles/   # deve retornar 12 títulos (seed automático populou o RDS)
```

E de fora (na sua máquina):
```bash
curl http://<IP_EC2>/titles/
```

📸 `docs/screenshots/07-backend-ec2.png`.

> Se `/titles/` falhar: `docker compose -f docker-compose.prod.yml logs api`. Causas comuns:
> senha do RDS errada, SG `watchlist-rds-sg` sem a regra 5432 do `watchlist-ecs-sg`, ou `DB_HOST` errado.

---

## 6. Lambda `/report`

Console → **Lambda** → **Create function**:
- Function name: `watchlist-report`
- Runtime: **Node.js 20.x** · Architecture: x86_64
- Execution role: **Use an existing role** → `LabRole`

Aba **Code** → colar `src/lambda/index.mjs` (arquivo `index.mjs`). Handler = `index.handler`. **Deploy**.

**Configuration → Environment variables**: `API_GATEWAY_URL` = `https://placeholder.invalid` (provisório).

📸 `docs/screenshots/08-lambda.png`.

---

## 7. API Gateway

Console → **API Gateway** → **Create API** → **REST API → Build**:
- Name: `watchlist-gw` · Endpoint Type: **Regional**

**Recursos e métodos:**
- **`/titles`** → método **ANY** → **HTTP Proxy** → `http://<IP_EC2>:80/titles/`
- **`/titles/{id}`** (recurso `id`, path `{id}`) → **ANY** → **HTTP Proxy** → `http://<IP_EC2>:80/titles/{id}`
- **`/report`** → **GET** → **Lambda Function** → ✅ Use Lambda Proxy integration → `watchlist-report`

**Enable CORS** em cada recurso (Actions → Enable CORS → replace).

**Deploy API** → stage **`prod`** → copiar **Invoke URL** (`APIGW`).

**Atualizar a Lambda:** `API_GATEWAY_URL` = a Invoke URL → Save.

Validar:
```bash
APIGW=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
curl $APIGW/titles/
curl $APIGW/titles/1
curl $APIGW/report
```

📸 `docs/screenshots/09-api-gateway.png`.

> ⚠️ O IP da EC2 muda se a instância for **parada e reiniciada**. Se isso acontecer, atualizar
> as integrações HTTP Proxy do `/titles` e `/titles/{id}` com o novo IP e **Deploy API** de novo.
> (Opcional: associar um **Elastic IP** à EC2 pra fixar o IP.)

---

## 8. Subir o frontend (container)

Voltar na EC2 (terminal):

```bash
cd ~/gabi-watchlist
export NEXT_PUBLIC_API_BASE_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
docker compose -f docker-compose.prod.yml up -d --build front
```

Abrir no navegador: `http://<IP_EC2>:3000`.

📸 `docs/screenshots/10-app-list.png`, `11-app-report.png`.

---

## 9. Validação E2E

Em `http://<IP_EC2>:3000`:
- `/` lista os 12 títulos
- `/new` cria
- `/titles/[id]` edita / exclui
- `/report` mostra o dashboard (Lambda via APIGW)

No DevTools (aba Network) confirmar que **todas** as chamadas vão pro `https://xxxxx.execute-api...` (API Gateway), nunca direto pro IP do backend.

---

## 10. Manutenção

### Atualizar o código (back ou front) na EC2
```bash
cd ~/gabi-watchlist && git pull
export DB_HOST=... DB_PASSWORD=... NEXT_PUBLIC_API_BASE_URL=...
docker compose -f docker-compose.prod.yml up -d --build
```

### Credenciais do Lab expiraram
Reabrir o Lab → pegar novas credenciais. (Só afeta o console/CLI; os containers na EC2 seguem rodando.)

### IP da EC2 mudou (instância reiniciada)
Atualizar as integrações do API Gateway (passo 7) com o novo IP + Deploy.

---

## 11. Solução de problemas

| Sintoma | Causa provável | Resolução |
|---|---|---|
| Backend não conecta no RDS | SG do RDS sem regra do SG da EC2, ou senha/host errado | conferir `watchlist-rds-sg` (5432 ← `watchlist-ecs-sg`) e as env vars |
| `docker compose` não encontra o comando | plugin não instalado | repetir o passo 4 (cli-plugins) |
| Build do front trava / OOM | t3.micro sem RAM | usar t3.medium (ou criar swap) |
| `/report` no APIGW retorna 502 | `API_GATEWAY_URL` errada na Lambda | conferir env da Lambda |
| App mostra URL antiga do APIGW | build do front com env stale | re-exportar `NEXT_PUBLIC_API_BASE_URL` e `up -d --build front` |
| Não conecta SSH/Instance Connect | porta 22 fechada no SG | adicionar regra SSH 22 no `watchlist-ecs-sg` |

---

## 12. Checklist da entrega

- [ ] VPC + subnet privada para o RDS ✅
- [ ] RDS Postgres `Publicly accessible: No` ✅
- [ ] EC2 rodando os 2 containers (backend + front) via Docker
- [ ] Lambda `watchlist-report` deployada
- [ ] API Gateway: `/titles`, `/titles/{id}` (HTTP Proxy → EC2) e `/report` (Lambda Proxy)
- [ ] App carrega em `http://<IP_EC2>:3000` consumindo o APIGW
- [ ] Screenshots de cada serviço em `docs/screenshots/`
- [ ] `docs/relatorio.pdf` (≤12 pg) com diagrama e capturas
- [ ] Vídeo (≤5 min, não-listado) com link no README
- [ ] ZIP no Moodle até 2026-05-29

---

## Anexo — CI/CD (opcional, não usado no deploy EC2)

O repo tem `.github/workflows/deploy-backend.yml` e `deploy-frontend.yml` que buildam e
empurram as imagens pro ECR (`gabi-watchlist-api`, `gabi-watchlist-front`). Foi a abordagem
original (ECS). Com o deploy em EC2 buildando via `git clone`, **não são necessários**, mas
ficam no repo como pipeline de build alternativo (e o backend já foi validado por eles).
