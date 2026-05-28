# Projeto Integrador – Cloud Developing 2026/1

> Watchlist de filmes/séries · CRUD + API Gateway + Lambda /report + RDS + Front-end

**Grupo:**
1. 10441930 - Gabriela [SOBRENOME] - Desenvolvimento full-stack, infra AWS, documentação, vídeo

## 1. Visão geral

Aplicação web de **watchlist pessoal de filmes e séries**: permite cadastrar, listar, atualizar e remover títulos (entidade única `title`), e gera um dashboard de estatísticas (`/report`) calculado por função Lambda.

## 2. Como rodar localmente (avaliação)

Pré-requisitos: Docker, Docker Compose, Node.js 20+ e npm.

### Passo 1 – Subir backend + Postgres

```bash
docker compose up --build
```

Esperar ~20s para o Postgres inicializar e a API popular o seed.

Validar:

```bash
curl http://localhost:8000/
curl http://localhost:8000/titles/
```

A segunda chamada deve retornar 12 títulos do seed inicial.

### Passo 2 – Subir frontend (em outro terminal)

```bash
cd src/frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Abrir <http://localhost:3000>.

Telas:
- `/` — lista de títulos em cards
- `/new` — formulário pra criar
- `/titles/[id]` — editar / excluir
- `/report` — dashboard de estatísticas (consome o backend; em produção será a Lambda)

### Passo 3 – Testar Lambda local (opcional)

Em outro terminal, com o backend rodando:

```bash
cd src/lambda
API_GATEWAY_URL=http://localhost:8000 node -e "import('./index.mjs').then(m => m.handler({}).then(r => console.log(r.body)))"
```

Esperado: JSON com as estatísticas.

### Passo 4 – Build do front em Docker (validação pra ECS)

```bash
cd src/frontend
docker build --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 -t watchlist-front:test .
docker run --rm -p 3000:3000 watchlist-front:test
```

Abrir <http://localhost:3000>.

## 3. Arquitetura (resumo — detalhe completo no PDF)

- **Back-end**: ECS Fargate (subnet pública) · FastAPI + SQLModel
- **Front-end**: ECS Fargate (subnet pública) · Next.js 15 + Tailwind
- **Banco**: Amazon RDS PostgreSQL (subnet privada)
- **Gateway**: Amazon API Gateway (REST) — única porta pública
- **Função `/report`**: AWS Lambda (Node.js 20)

## 4. Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET    | `/`             | Healthcheck |
| GET    | `/titles/`      | Lista (paginação `?offset&limit`) |
| GET    | `/titles/{id}`  | Busca por ID |
| POST   | `/titles/`      | Cria |
| PUT    | `/titles/{id}`  | Atualiza |
| DELETE | `/titles/{id}`  | Remove |
| GET    | `/report`       | Estatísticas (em prod = Lambda; local = backend) |

## 5. Estrutura

```
gabi-watchlist/
├── README.md
├── docker-compose.yml
├── docs/
├── infra/
└── src/
    ├── backend/   # FastAPI + Dockerfile + initialize.sql
    ├── frontend/  # Next.js 15 + Tailwind + Dockerfile
    └── lambda/    # index.mjs (Node 20 ES Modules)
```

## 6. Vídeo de demonstração

🎥 [link a inserir]
