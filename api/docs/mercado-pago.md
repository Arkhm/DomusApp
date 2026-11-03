# Pagamentos Pix — Checkout Transparente / Orders API

O backend mantém Express → controller → service → repository → Prisma/MySQL. A emissão e os webhooks usam a Orders API; não há checkout hospedado, cartão, boleto ou assinatura automática.

O estado do ambiente e o roteiro de Insomnia estão no [relatório da raiz](../../report.md). O banco local foi reinicializado por autorização, sincronizado com `db push` e populado pelo seed.

## Configuração e execução

Configure no `.env` da raiz:

```dotenv
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_SELLER_ID=
MERCADO_PAGO_SANDBOX=true
MERCADO_PAGO_WEBHOOK_SECRET=
MERCADO_PAGO_WEBHOOK_URL=https://api.seudominio.com/invoices/webhook
```

O token fica somente no backend. A public key e as senhas das contas de teste não são necessárias a este fluxo. `MERCADO_PAGO_SANDBOX` é obrigatório: não se infere o ambiente pelo prefixo do token. A consulta autenticada a `/users/me` confere o vendedor, o país e a classificação da conta como usuário de teste antes das chamadas de pagamento. A flag local não transforma uma credencial produtiva em credencial de teste.

No painel Mercado Pago, configure Webhooks → ambiente correspondente → tópico **Order** → URL HTTPS pública terminada em `/invoices/webhook`. Copie a assinatura secreta gerada para `MERCADO_PAGO_WEBHOOK_SECRET`. Essa assinatura é diferente do Access Token. `MERCADO_PAGO_WEBHOOK_URL` documenta a URL a cadastrar no painel; ela não é enviada como propriedade de criação da order.

Sem assinatura configurada, o endpoint responde 503 e não aceita notificações. A criação de Pix de teste continua disponível para permitir a configuração local; em produção, a ausência da assinatura também bloqueia a emissão. Não habilite produção sem configurar e testar as entregas HTTPS do painel.

```bash
docker compose up -d --build
docker compose exec api npx prisma db push
docker compose exec api npx prisma db seed
docker compose exec api npx prisma generate
docker compose restart api payment-worker
```

O Compose padrão aguarda o MySQL saudável e inicia API e worker. O fluxo acima prepara um banco local novo; não repita o seed em banco populado. O volume `api_node_modules` é compartilhado entre os serviços. O serviço de migrações fica no perfil opcional `migrations` e pode ser chamado com `docker compose --profile migrations run --rm migrations` para ambientes que usam o histórico versionado. `db push` não cria esse histórico; faça baseline antes de trocar de estratégia em um banco preenchido. Para produção, aplique migrações versionadas antes de iniciar os serviços. O Dockerfile também possui `npm start` válido para execução independente.

Fora do Docker, instale com `npm ci`, configure o ambiente da API, execute `npm run db:deploy`, `npm start` e `npm run payments:worker` em processos separados. O adaptador usa `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD` e `DATABASE_NAME`; o CLI Prisma usa `DATABASE_URL`.

## Contrato HTTP

Todas as rotas, exceto o webhook, exigem a autenticação já existente. Administração, funcionário e morador com `isSyndic=true` podem emitir e administrar cobranças. O morador comum consulta apenas suas faturas.

| Rota | Comportamento |
|---|---|
| `POST /invoices` | Cria a obrigação e a tentativa antes da chamada externa; retorna 201 ou 202 se a emissão estiver pendente |
| `POST /invoices/batch` | Valida todo o lote, persiste atomicamente e retorna 202; o worker emite cada Pix |
| `GET /invoices`, `GET /invoices/:id` | Retornam faturas, estado de emissão, ambiente, valor enviado e expiração |
| `PUT /invoices/:id/status` | Aceita somente `PAID` ou `CANCELLED`, com `reason` obrigatório |
| `DELETE /invoices/:id` | Cancela com `reason` no JSON do corpo; não executa reembolso |
| `POST /invoices/:id/reconcile` | Exige `reason`; consulta o provedor e aplica a situação verificada, sem criar outra order |
| `POST /invoices/:id/retry` | Exige `reason`; agenda recuperação usando o mesmo payload e chave, sem criar outra fatura |
| `GET /invoices/:id/audit` | Retorna os últimos 100 registros de auditoria, somente para administração |
| `GET /invoices/payments/health` | Mostra filas, falhas, operações incertas e faturas para revisão, somente para administração |
| `POST /invoices/webhook?data.id=ORD...` | Valida assinatura, persiste a entrega e responde 200 antes do processamento externo |

Em `POST /invoices` e `/batch`, envie `Idempotency-Key` com 16 a 128 caracteres alfanuméricos, hífen ou sublinhado; UUID é recomendado. Gere a chave uma vez por operação lógica e reutilize-a ao repetir a mesma operação. A chave é vinculada ao usuário autenticado e ao tipo de operação. Repetição com conteúdo equivalente recupera as mesmas faturas; conteúdo diferente retorna 409. Uma nova chave representa uma nova emissão intencional.

Exemplo de corpo de criação:

```json
{
  "description": "Taxa condominial",
  "amount": "250.00",
  "dueDate": "2026-11-10",
  "userId": "uuid-do-morador",
  "unitId": "uuid-da-unidade",
  "type": "MONTHLY_FEE",
  "referenceMonth": "2026-11-01"
}
```

O lote usa os mesmos campos comuns, substituindo `userId` e `unitId` por `userIds`. Aceita de 1 a 100 usuários distintos, ativos e vinculados a unidades. Uma falha de validação rejeita o lote antes da emissão. O contrato mantém `created` e `errors` (este último vazio após validação), acrescentando `operationId`; as falhas posteriores ficam em cada tentativa e na auditoria. Uma mesma operação de lote pode ser repetida para consultar suas faturas.

Os campos adicionados ao retorno são `issuanceStatus`, `paymentEnvironment`, `paymentAmount`, `paymentExpiresAt`, `paymentSource` e `requiresReview`. `paymentData` mantém QR e IDs e acrescenta `ticketUrl`, que contém instruções de pagamento Pix. `boletoUrl` permanece nulo. A resposta completa do provedor, o payload persistido e as chaves internas não são expostos. QR e ticket só são disponibilizados enquanto a tentativa está ativa.

As respostas distinguem 400 (entrada), 401 (autenticação/assinatura), 403 (permissão), 404 (fatura), 409 (conflito/conciliação), 500 (falha interna) e 503 (configuração/provedor indisponível). Uma criação pode ter sido aceita e persistida mesmo quando a resposta se perde: repita a chave original.

## Estados e recuperação

`Invoice.status` representa a obrigação financeira. O estado da tentativa fica separado:

- `QUEUED`, `ISSUING` e `RETRY`: emissão ainda não resolvida.
- `ACTIVE`: Pix aguardando pagamento.
- `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED` e `CHARGED_BACK`: situação financeira confirmada no provedor.
- `CANCELLED`, `EXPIRED` e `REJECTED`: tentativa encerrada; a expiração ou falha do Pix não extingue a dívida.
- `REVIEW`: automação suspensa por divergência ou esgotamento das tentativas.

O Pix vale 24 horas, independentemente do vencimento da fatura. A dívida não é automaticamente perdoada nem uma nova cobrança emitida quando o código expira. A reemissão de um novo Pix para uma tentativa já encerrada não faz parte desta versão.

Em teste, o payload oficial envia R$ 50, `test_payer@example.com` e `APRO`. `paymentAmount` expõe o valor efetivamente enviado, mesmo se a fatura tiver outro valor. A aprovação simulada atualiza a tentativa e o histórico com origem `MERCADO_PAGO_TEST`, mas **não quita a obrigação financeira nem altera `paidAt`**. Em produção, a baixa exige que valor da fatura, valor enviado e valor consultado coincidam.

Baixa manual exige justificativa e cancelamento confirmado de um Pix ainda pagável. Se o provedor confirmar pagamento durante o cancelamento, a baixa manual é rejeitada e o pagamento externo é conciliado. As alterações registram autor, motivo, horário, origem, valor e transição. Reembolsos parciais e recebimento posterior a uma baixa manual exigem revisão financeira; o endpoint de conciliação não apaga essa sinalização automaticamente.

As tentativas guardam o payload original e a chave do provedor. Após resultado incerto, a recuperação busca a referência externa antes de repetir a criação. Não se repete criação após 24 horas de incerteza. Retry administrativo mantém essa janela e não permite contornar divergências financeiras. O worker usa leases de 120 segundos com token de posse, controle de versão da fatura, timeout HTTP de 8 segundos, espera exponencial com jitter e respeito a `Retry-After`. Após 8 falhas da tentativa ou 12 falhas de entrega, exige revisão. Entregas ocupadas por outro worker não consomem esse limite.

O HMAC usa o identificador assinado da query, `x-request-id` e `ts`, com ID normalizado para minúsculas. O identificador do corpo deve corresponder à query. A caixa de entrada deduplica entregas, e a atualização financeira é idempotente. Todas as baixas consultam a order autenticada; valores e status recebidos no webhook não são usados como comprovante de pagamento. Repetições legítimas antigas são aceitas, e timestamps futuros além de cinco minutos são rejeitados.

A consulta periódica das tentativas ativas, a cada 15 minutos, funciona como recuperação complementar; webhooks continuam sendo o fluxo principal. Não há consulta contínua de pagamentos encerrados: estornos posteriores dependem das notificações ou de conciliação administrativa.

Faturas anteriores à migração com `mpOrderId` são sinalizadas para revisão. A conciliação administrativa pode importar uma tentativa a partir da order existente, usando a referência efetivamente devolvida e conferindo os valores em produção. O payload e a chave originais não são inventados: o registro informa que a requisição histórica está indisponível, e a tentativa já vinculada nunca entra no fluxo de criação. Faturas sem evidência externa ou com divergência permanecem para conferência; a migração não modifica baixas ou datas históricas.

## Verificação

Na pasta `api`:

```bash
npm run typecheck
npm test
npm run payments:verify
npm run payments:verify -- --pix
```

`payments:verify` lê o `.env` da raiz e confere a conta sem imprimir credenciais. `--pix` só funciona com conta de teste: cria uma order de R$ 50, repete a mesma chave e verifica o recurso. Essa verificação não grava faturas no banco.

Os testes de integração exigem um MySQL descartável migrado, `RUN_PAYMENT_INTEGRATION=true` e as variáveis `DATABASE_*` apontando para um banco com nome terminado em `_test`. Eles simulam o provedor, exercitam transações e concorrência reais no MySQL e não usam o token externo. Sem essa flag, a integração é explicitamente marcada como ignorada.

Os testes cobrem assinatura, valores, permissões, idempotência concorrente, recuperação após timeout, deduplicação concorrente, reembolso, resposta antiga, perda de lease, expiração, baixa manual, corrida de cancelamento, retry limitado, importação legada, lote e contratos HTTP. A entrega HTTPS real do painel ainda deve ser verificada após preencher a assinatura secreta e cadastrar a URL pública.

Documentação oficial consultada:

- [Criação de order](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/create-order/post)
- [Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix)
- [Teste Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix)
- [Notificações](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications)
- [Estados](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/order-status)

A dependência transitiva `body-parser` foi atualizada para 2.4.0, corrigindo [GHSA-27r3-jxmh-p828](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828). O lockfile mantém a atualização compatível com Express.
