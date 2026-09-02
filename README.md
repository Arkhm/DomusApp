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

Abra o `.env` e preencha `DATABASE_PASSWORD` com uma senha de sua escolha.

O `.env.example` também traz as variáveis de segurança. Em desenvolvimento os padrões já servem; em produção, ajuste:

| Variável | Para que serve |
|---|---|
| `JWT_SECRET` | Assina o token de sessão. **Use um segredo próprio**, nunca o do `.env.example`. |
| `ALLOWED_ORIGIN` | Origens autorizadas a chamar a API (separadas por vírgula). Qualquer outra recebe `403`. |
| `NODE_ENV` | Em `production`, o cookie de sessão passa a exigir HTTPS (`secure`). |
| `COOKIE_SAMESITE` | `strict` por padrão. Só mude para `none` se API e front ficarem em domínios diferentes — e aí `COOKIE_SECURE=true` é obrigatório. |
| `TRUST_PROXY` | Quantos proxies confiar no `X-Forwarded-For`. Necessário atrás de Railway/Render/nginx para o rate limiter enxergar o IP real. |

**3. Suba os contêineres:**

```bash
docker compose up -d
```

**4. Aplique as migrations versionadas e popule o banco:**

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma generate
docker compose exec api npx prisma db seed
docker compose restart api
```

> **Por que `migrate deploy` em vez de `db push`?** As migrations vivem em `api/prisma/migrations/` e documentam todo o histórico do schema. `db push` cria o schema direto e ignora isso — o time inteiro precisa usar `migrate deploy` pra ficar consistente.

**5. Acesse a aplicação:**

| Serviço | URL |
|---|---|
| Frontend (Painel Web) | http://localhost:5173 |
| API Backend | http://localhost:3333 |
| MySQL | localhost:3307 |

---

## 🔄 Após puxar mudanças (`git pull`)

Sempre que sincronizar com a `main`, rode este fluxo dentro da pasta do projeto:

```bash
git pull
docker compose up -d
docker compose exec api npx prisma migrate deploy   # aplica migrations novas (se houver)
docker compose exec api npx prisma generate          # regenera o Prisma Client
docker compose restart api                           # reinicia a API com o client novo
```

### ⚠️ Pegadinha do `docker compose down`

O `docker compose down` **descarta o volume anônimo** `/usr/src/app/node_modules` do container da API (mesmo sem `-v`). Isso significa que o Prisma Client volta ao estado da imagem do build (provavelmente desatualizado).

**Sintoma:** erro `Cannot read properties of undefined (reading 'findMany')` em qualquer endpoint.

**Fix:** sempre rode `prisma generate` depois de um `down + up`:

```bash
docker compose down
docker compose up -d
docker compose exec api npx prisma generate          # ← obrigatório
docker compose restart api
```

> Migrations não precisam ser reaplicadas — elas vivem no volume nomeado do MySQL, que persiste através de `down`.

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
