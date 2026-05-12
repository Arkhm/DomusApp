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
- React (Vite)
- Axios

**Infraestrutura**
- Docker & Docker Compose

---

## 📂 Estrutura do Projeto

```
/api      → Backend da aplicação
/web      → Frontend web
/mobile   → App mobile
```

---

## 🛠️ Como Rodar o Projeto Localmente

### Pré-requisitos

- **Docker** e **Docker Compose** instalados
- **Git** instalado

### Passo a Passo

**1. Clone o repositório:**

```bash
git clone https://github.com/Arkhm/DomusApp.git
cd DomusApp
```

**2. Configure as variáveis de ambiente:**

Copie o arquivo de exemplo e crie o seu `.env`:

```bash
cp .env.example .env
```

Abra o arquivo `.env` gerado e preencha a variável `DATABASE_PASSWORD` com uma senha de sua escolha.

**3. Inicie os contêineres:**

```bash
docker compose up -d
```

**4. Prepare o banco de dados (migrações e seed):**

Com os contêineres rodando, crie as tabelas e popule o banco com seeder:

```bash
docker compose exec api npx prisma db push
docker compose exec api npx prisma db seed
```

**5. Acesse a aplicação:**

| Serviço | URL |
|---|---|
| Frontend (Painel Web) | http://localhost:5173 |
| API Backend | http://localhost:3333 |

---

## 🔑 Credenciais de Acesso (geradas no seed)

| Campo | Valor |
|---|---|
| E-mail | `admin@domusapp.com` |
| Senha | `admin123` |

---

## 👥 Equipe

- Erick Nepomuceno Ribeiro Silva
- Gabriel Francisco Vaz Azevedo
- João Marcelo Conceição Sousa
- Juliano Aparecido Bernardo Quirino Junior
