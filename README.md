# 🏢 DomusApp — Sistema de Gestão Condominial

O DomusApp é uma plataforma moderna para gestão de condomínios, facilitando a comunicação entre a administração (síndicos) e os moradores. Ele centraliza avisos, eventos, gestão de unidades e controle de acesso.

---

## 🚀 Tecnologias Utilizadas

**Backend**
- Node.js com Express
- TypeScript
- Prisma ORM
- MySQL
- JWT para autenticação e controle de permissões

**Frontend**
- React 19 + Vite + TypeScript
- Tailwind v4
- motion/react
- Axios

**Infraestrutura**
- Docker & Docker Compose

---

## 📂 Estrutura do Projeto

```
/api      → Backend da aplicação
/web      → Frontend web (painel administrativo)
/mobile   → App mobile (em planejamento — destino dos moradores)
```

---

## 🛠️ Como Rodar o Projeto Localmente

### Pré-requisitos

- **Docker** e **Docker Compose** instalados
- **Git** instalado

### Setup inicial (primeira vez)

**1. Clone o repositório:**

```bash
git clone https://github.com/Arkhm/DomusApp.git
cd DomusApp
```

**2. Configure as variáveis de ambiente:**

```bash
cp .env.example .env
```

Abra o `.env`, preencha `DATABASE_PASSWORD`, mantenha `DATABASE_URL` sincronizada e gere um `JWT_SECRET` próprio (`openssl rand -hex 32`). Não sobrescreva um `.env` existente com suas credenciais. O único modelo versionado é `.env.example`.

O `.env.example` reúne as variáveis de banco, autenticação, pagamentos e ferramentas. Os campos de segredo devem ser preenchidos mesmo em desenvolvimento. Em produção, ajuste também:

| Variável | Para que serve |
|---|---|
| `JWT_SECRET` | Assina o token de sessão; gere um segredo próprio. O exemplo deixa esse campo vazio. |
| `ALLOWED_ORIGIN` | Origens autorizadas a chamar a API (separadas por vírgula). Qualquer outra recebe `403`. |
| `NODE_ENV` | Em `production`, o cookie de sessão passa a exigir HTTPS (`secure`). |
| `COOKIE_SAMESITE` | `strict` por padrão. Só mude para `none` se API e front ficarem em domínios diferentes — e aí `COOKIE_SECURE=true` é obrigatório. |
| `TRUST_PROXY` | Redes/endereços dos proxies confiáveis, por exemplo `loopback` para proxy local. Permite interpretar o IP encaminhado sem confiar em toda a internet. |

**3. Confira o banco e suba os contêineres:**

O fluxo local usa `db push`; o serviço `migrations` é opcional. Confira a estratégia de banco em [report.md](report.md#2-containers-e-inicialização).

```bash
docker compose up -d --build
```

**4. Prepare um banco local novo:**

```bash
docker compose exec api npx prisma db push
docker compose exec api npx prisma db seed
docker compose exec api npx prisma generate
docker compose restart api payment-worker
```

Execute o seed apenas uma vez no banco limpo. Ele pode acrescentar unidades quando repetido. A inicialização normal não apaga volumes nem recria dados.

**5. Acesse a aplicação:**

| Serviço | URL |
|---|---|
| Frontend (Painel Web) | http://localhost:5173 |
| API Backend | http://localhost:3333 |
| MySQL | localhost:3307 |

---

## 🔄 Após puxar mudanças (`git pull`)

Depois de sincronizar o código, confira as alterações de ambiente e migrações:

```bash
git pull
docker compose up -d --build
docker compose logs --tail=100 api payment-worker
```

Ao alterar o schema local, execute `docker compose exec api npx prisma db push`, `docker compose exec api npx prisma generate` e reinicie API e worker. Não repita o seed. O volume `api_node_modules` é compartilhado, e os volumes persistem em `docker compose down` sem `-v`. O perfil opcional `migrations` mantém o caminho de migrações versionadas; consulte o relatório antes de trocar de estratégia.

---

## 🔑 Modelo de Acesso ao Painel

O painel web é **administrativo** — só estas pessoas conseguem logar:

- `role = ADMIN` — administração
- `role = FUNCIONARIO` — equipe operacional (porteiro, zelador)
- `role = MORADOR && isSyndic = true` — a síndica eleita

**Morador comum (`MORADOR && !isSyndic`) é bloqueado no login** com 401 + "Sua conta não tem acesso ao painel administrativo." Ele será atendido pelo app mobile (em desenvolvimento).

**Quem pode mutar (criar/excluir):** apenas `ADMIN`. Síndica e funcionário acessam em **modo leitura** — veem tudo (inclusive rascunhos e contadores de leitura), mas não têm botões de "Novo X" nem ícones de lixeira.

---

## 👤 Credenciais (geradas no seed)

| Perfil | E-mail | Senha | Acessa o painel? |
|---|---|---|---|
| Administrador | `admin@domusapp.com` | `admin123` | ✅ acesso total |
| Síndica (Maria, Bloco A 101) | `maria@email.com` | `123456` | ✅ leitura |
| Funcionário (Carlos, porteiro) | `carlos@email.com` | `123456` | ✅ leitura |
| Morador (João, Bloco B 202) | `joao@email.com` | `123456` | ❌ bloqueado (mobile) |

---

## 📚 Comandos Úteis

```bash
# Ver logs da API em tempo real
docker compose logs api -f

# Resetar o banco (apaga todos os dados e re-aplica migrations)
docker compose exec api npx prisma migrate reset

# Abrir um shell dentro do container da API
docker compose exec api sh

# Validar tipos e build de produção do front
cd web && npm run build
cd web && npm run lint

# Verificar as proteções de segurança contra a API rodando
# (cookie httpOnly, rate limiting, headers do Helmet e CORS restritivo)
cd api && npm run check:security
```

> O `check:security` consome a cota de login do seu IP (10 tentativas/15min por design). Para rodar duas vezes seguidas, reinicie a API entre as execuções: `docker compose restart api`.

---

## 👥 Equipe

- Erick Nepomuceno Ribeiro Silva
- Gabriel Francisco Vaz Azevedo
- João Marcelo Conceição Sousa
- Juliano Aparecido Bernardo Quirino Junior

## Pagamentos

A referência técnica da integração Pix também está em [api/docs/mercado-pago.md](api/docs/mercado-pago.md).
