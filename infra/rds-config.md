# Configuração do RDS PostgreSQL

| Item | Valor |
|---|---|
| Identificador | `watchlist-db` |
| Engine | PostgreSQL 15.x |
| Modelo | Dev/Test |
| Classe | `db.t3.micro` (burstable) |
| Armazenamento | 20 GB gp3 |
| **Acesso público** | **Não** ← requisito do enunciado |
| Subnet group | `watchlist-db-subnet-group` (2 subnets privadas) |
| VPC security group | `watchlist-rds-sg` (aceita 5432 só do SG `watchlist-ecs-sg`) |
| Nome do banco inicial | `watchlist` |
| Usuário mestre | `postgres` |
| Senha mestre | armazenada fora do repo (gerenciador de senhas) |
| Endpoint | `<a preencher quando ficar Disponível>` |
| **Criptografia em repouso** | **Desabilitada** (limitação do Learner Lab — `LabRole` sem acesso à KMS key padrão `aws/rds`. Em produção, habilitaria com KMS customer-managed.) |

## Variáveis de ambiente do backend (entram na ECS Task Definition)

| Var | Valor |
|---|---|
| `DB_HOST` | endpoint do RDS |
| `DB_PORT` | `5432` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | senha mestre (colar direto no console; **não commitar**) |
| `DB_NAME` | `watchlist` |

## Restrições atendidas (avaliação)

- ✅ Em subnet **privada** (não roteia pra IGW)
- ✅ `Publicly accessible = No`
- ✅ Porta 5432 só aberta para o Security Group do ECS
- ✅ Sem porta exposta à internet
