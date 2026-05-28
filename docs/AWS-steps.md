# AWS — Passo a passo do deploy

> Provisionamento da infraestrutura da Watchlist na AWS. O back-end e o front-end
> rodam em **EC2 + Docker**; o banco em **RDS PostgreSQL** (subnet privada);
> as estatísticas em **AWS Lambda**; e o **API Gateway** é a única porta pública.

## Visão geral da arquitetura

```
Usuário (navegador)
        │
        ▼
[ Front-end Next.js  (EC2 :3000) ] ── chamadas ──▶ [ API Gateway (REST, stage prod) ]
                                                      │                        │
                                                      │ /titles, /titles/{id}  │ /report
                                                      ▼                        ▼
                                            [ Back-end FastAPI (EC2 :80) ]   [ Lambda Node 20 ]
                                                      │                        │ consome /titles
                                                      ▼                        └─ via API Gateway
                                            [ RDS PostgreSQL (subnet privada) ]
```

| Camada | Serviço AWS | Nome |
|---|---|---|
| Rede | VPC `10.0.0.0/16`, 2 subnets públicas + 2 privadas, IGW | `watchlist-vpc` |
| Banco | RDS PostgreSQL 15, subnet privada | `watchlist-db` |
| Compute | 1 instância EC2 rodando 2 containers Docker | `watchlist-server` |
| Serverless | Lambda Node.js 20 | `watchlist-report` |
| Gateway | API Gateway REST, stage `prod` | `watchlist-gw` |

**Região:** `us-east-1` · **IAM role:** `LabRole`.

---

## 1. VPC e Security Groups

### 1.1 VPC (wizard "VPC and more")

Console → **VPC** → **Create VPC** → **VPC and more**:
- Name tag: `watchlist`
- IPv4 CIDR: `10.0.0.0/16`
- 2 Availability Zones · 2 subnets públicas · 2 subnets privadas
- NAT gateways: **None** · VPC endpoints: **None**

### 1.2 Security Groups

VPC → **Security Groups** → **Create security group**:

**`watchlist-ecs-sg`** (containers da EC2):
| Tipo | Porta | Origem |
|---|---|---|
| Custom TCP | 80 | `0.0.0.0/0` (back-end) |
| Custom TCP | 3000 | `0.0.0.0/0` (front-end) |
| SSH | 22 | seu IP (acesso à instância) |

**`watchlist-rds-sg`** (RDS):
| Tipo | Porta | Origem |
|---|---|---|
| PostgreSQL | 5432 | SG `watchlist-ecs-sg` |

Detalhes em `infra/vpc-config.md`.

---

## 2. RDS PostgreSQL

1. **Subnet group** `watchlist-db-subnet-group` com as 2 subnets privadas.
2. **Create database** → PostgreSQL 15 · template **Dev/Test** · `db.t3.micro` · 20 GB gp3.
   - Usuário mestre `postgres`; senha forte (anotar fora do repo).
   - **Acesso público: Não** · SG `watchlist-rds-sg`.
   - Nome inicial do banco: `watchlist`.
   - **Criptografia: desabilitada** (o `LabRole` do laboratório não acessa a KMS padrão `aws/rds`).
3. Anotar o **endpoint** (`watchlist-db.xxxx.us-east-1.rds.amazonaws.com`).

> Não é preciso criar tabela nem rodar SQL manualmente: o back-end cria a tabela `title`
> e popula 12 títulos automaticamente no startup.

Detalhes em `infra/rds-config.md`.

---

## 3. EC2 — instância

Console → **EC2** → **Executar instâncias**:

| Campo | Valor |
|---|---|
| Nome | `watchlist-server` |
| AMI | Amazon Linux 2023 |
| Tipo | `t3.small` |
| Par de chaves | `vockey` |
| Rede | VPC `watchlist-vpc`, subnet **pública**, IP público **ativado** |
| Grupo de segurança | `watchlist-ecs-sg` |
| Perfil de instância IAM | `LabInstanceProfile` |
| Armazenamento | 20 GB gp3 |

Anotar o **IP público** (`<IP_EC2>`).

---

## 4. EC2 — instalar Docker e subir os containers

Conectar via **EC2 Instance Connect** (botão Conectar) e rodar:

```bash
# Docker + git + plugins
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-*
newgrp docker

# código
git clone https://github.com/gabinellessen/gabi-watchlist.git
cd gabi-watchlist
```

**Back-end** (porta 80, apontando pro RDS):

```bash
export DB_HOST=watchlist-db.xxxx.us-east-1.rds.amazonaws.com
export DB_PASSWORD='<senha-do-rds>'
docker compose -f docker-compose.prod.yml up -d --build api
curl http://localhost/titles/   # deve listar 12 títulos
```

> A instância t3.small tem 2 GB de RAM; se o build do front faltar memória,
> crie um swap: `sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`.

O front é subido depois (passo 7), com a URL do API Gateway.

---

## 5. Lambda `/report`

Console → **Lambda** → **Create function**:
- Nome: `watchlist-report` · Runtime: **Node.js 20.x** · Role: **LabRole**.
- Aba **Code** → colar `src/lambda/index.mjs` (handler `index.handler`) → **Deploy**.
- **Configuration → Environment variables** → `API_GATEWAY_URL` = (preenchido no passo 6).

---

## 6. API Gateway

Console → **API Gateway** → **REST API → Build** → nome `watchlist-gw` (Regional).

- **`/titles`** → método **ANY** → **HTTP Proxy** → `http://<IP_EC2>:80/titles/`
- **`/titles/{id}`** → **ANY** → **HTTP Proxy** → `http://<IP_EC2>:80/titles/{id}`
- **`/report`** → **GET** → **Lambda Function** (Use Lambda Proxy) → `watchlist-report`
- **Enable CORS** em cada recurso.
- **Deploy API** → stage **`prod`** → copiar a **Invoke URL**.

Atualizar a Lambda: `API_GATEWAY_URL` = a Invoke URL. Validar:

```bash
APIGW=https://xxxx.execute-api.us-east-1.amazonaws.com/prod
curl $APIGW/titles/
curl $APIGW/report
```

---

## 7. Front-end

Na EC2, com a URL do API Gateway:

```bash
cd ~/gabi-watchlist
export NEXT_PUBLIC_API_BASE_URL=https://xxxx.execute-api.us-east-1.amazonaws.com/prod
docker compose -f docker-compose.prod.yml up -d --build front
```

Abrir `http://<IP_EC2>:3000` — lista, criar, editar, excluir e relatório.

No DevTools (Network) dá pra confirmar que **todas** as chamadas de dados passam pelo API Gateway.

---

## 8. Validação ponta a ponta

```bash
APIGW=https://xxxx.execute-api.us-east-1.amazonaws.com/prod
curl $APIGW/titles/                # lista
curl -X POST $APIGW/titles/ -H 'Content-Type: application/json' \
  -d '{"name":"Oppenheimer","kind":"movie","genre":"drama","year":2023}'
curl -X PUT $APIGW/titles/13 -H 'Content-Type: application/json' -d '{"watched":true}'
curl -X DELETE $APIGW/titles/13
curl $APIGW/report                 # estatísticas (Lambda)
```

---

## 9. Solução de problemas

| Sintoma | Causa provável | Resolução |
|---|---|---|
| Back-end não conecta no RDS | SG do RDS sem a regra do SG da EC2, ou senha/host errado | conferir `watchlist-rds-sg` (5432 ← `watchlist-ecs-sg`) e as variáveis `DB_*` |
| `docker compose` não acha o comando | plugin não instalado | repetir os `curl` de cli-plugins do passo 4 |
| Build do front falha por memória | t3.small com pouca RAM | criar swap (ver passo 4) |
| `/report` retorna 502 | `API_GATEWAY_URL` errada na Lambda | conferir a env var da função |
| App mostra URL antiga do API Gateway | build do front com env desatualizada | re-exportar `NEXT_PUBLIC_API_BASE_URL` e `up -d --build front` |
