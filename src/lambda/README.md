# Lambda /report

Função Node.js 20 (ES Modules) que consome a API via API Gateway e retorna estatísticas.

## Variáveis de ambiente

- `API_GATEWAY_URL`: URL base do API Gateway (sem `/titles/` no final).
  Ex: `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod`

## Handler

`index.handler`

## Runtime

Node.js 20.x (ES Modules)

## Teste local (com backend rodando)

```bash
API_GATEWAY_URL=http://localhost npm run local
```

Esperado: JSON com estatísticas.

## Deploy manual (AWS Console)

1. Lambda → Create function
2. Name: `watchlist-report`
3. Runtime: Node.js 20.x
4. Architecture: x86_64
5. Execution role: **Use an existing role** → `LabRole`
6. Cole o conteúdo de `index.mjs` no editor da função (renomeie o arquivo no console para `index.mjs`)
7. Configuration → Environment variables → adicionar `API_GATEWAY_URL` apontando para o stage `prod` do API Gateway
8. Deploy
