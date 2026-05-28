# Configuração de VPC e Security Groups

> Criado via wizard **VPC and more** do console (1 clique cria VPC + 4 subnets + IGW + route tables).

## VPC

| Item | Valor |
|---|---|
| Nome | `watchlist-vpc` |
| CIDR | `10.0.0.0/16` |
| Região | `us-east-1` |
| Tenancy | Default |
| DNS hostnames | Enabled |

## Subnets

| Nome | Tipo | AZ | CIDR |
|---|---|---|---|
| `watchlist-subnet-public1-us-east-1a` | pública | us-east-1a | 10.0.0.0/20 |
| `watchlist-subnet-public2-us-east-1b` | pública | us-east-1b | 10.0.16.0/20 |
| `watchlist-subnet-private1-us-east-1a` | privada | us-east-1a | 10.0.128.0/20 |
| `watchlist-subnet-private2-us-east-1b` | privada | us-east-1b | 10.0.144.0/20 |

*(CIDRs exatos podem variar — confira no console se forem citados no PDF.)*

## Internet Gateway

- Nome: `watchlist-igw`
- Anexado a `watchlist-vpc`

## Route Tables

| Nome | Subnets associadas | Rotas |
|---|---|---|
| `watchlist-rtb-public` | as 2 públicas | `0.0.0.0/0` → `watchlist-igw` + local |
| `watchlist-rtb-private1-us-east-1a` | private1 | apenas local `10.0.0.0/16` |
| `watchlist-rtb-private2-us-east-1b` | private2 | apenas local `10.0.0.0/16` |

**NAT Gateway:** nenhum (intencional — o ECS fica em subnet pública com IP público; o RDS na privada só fala com o ECS via Security Group).

## Security Groups

### `watchlist-ecs-sg` (containers ECS — backend e front)

| Direção | Protocolo | Porta | Origem |
|---|---|---|---|
| Inbound | TCP | 80 | `0.0.0.0/0` (backend) |
| Inbound | TCP | 3000 | `0.0.0.0/0` (frontend) |
| Outbound | All | All | `0.0.0.0/0` (padrão) |

### `watchlist-rds-sg` (RDS Postgres)

| Direção | Protocolo | Porta | Origem |
|---|---|---|---|
| Inbound | TCP (PostgreSQL) | 5432 | SG `watchlist-ecs-sg` |
| Outbound | All | All | `0.0.0.0/0` (padrão) |

> O RDS aceita conexões **somente** vindas do SG do ECS — atende ao requisito do enunciado de "sem porta exposta à internet".
