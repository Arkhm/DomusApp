# DomusApp — Mobile

App do morador do DomusApp, em Expo + React Native + TypeScript.
Consome a API REST do monorepo (`../api`).

Esta rodada entrega **duas telas navegáveis e funcionais**: **Login** e **Home
(dashboard)**. Os demais módulos aparecem no grid e levam a um placeholder
"Em breve" que explica exatamente o que falta do lado da API.

---

## O que está pronto

| Item | Situação |
| --- | --- |
| Login com e-mail + senha | ✅ integrado a `POST /auth/login` |
| Validação de campos, loading, erro de credencial, erro de rede | ✅ |
| Token em `expo-secure-store` (Keychain / EncryptedSharedPreferences) | ✅ |
| Sessão restaurada ao abrir o app | ✅ valida via `GET /users/me` |
| Home com saudação + identificação do morador | ✅ |
| Resumo do topo (comunicados e próximo evento) | ✅ `GET /notices` + `GET /events` |
| Grid com os 15 módulos | ✅ (todos apontam para "Em breve") |
| Bottom tabs: Início / Reservas / Acessos / Encomendas / Perfil | ✅ (3 abas são placeholders) |
| Comportamento com a API fora do ar | ✅ banner de erro + "Tentar de novo" |
| Design tokens centralizados, fonte Inter, alvo 390×844 | ✅ |

Sem link de "Criar conta": moradores são cadastrados pela administração no
painel web. "Esqueci minha senha" abre um aviso orientando a procurar a
administração do condomínio: a redefinição de senha é feita sempre por ela,
não pelo app.

---

## Como rodar

Pré-requisitos: Node 18+ e o app **Expo Go** no celular (ou um emulador
Android / simulador iOS).

```bash
cd mobile && npm install
```

```bash
npm start
```

Depois escaneie o QR Code com o Expo Go, ou use:

```bash
npm run android
```

```bash
npm run ios
```

```bash
npm run web
```

Checagem de tipos:

```bash
cd mobile && npx tsc --noEmit
```

---

## Como apontar a baseURL para a API local

A URL da API vem de `app.config.ts` (`extra.apiUrl`) e é lida em
`src/services/api.ts`. O padrão é `http://localhost:3333`.

Suba a API antes (na raiz do monorepo):

```bash
docker compose up api db
```

Para trocar o endereço, defina `DOMUS_API_URL` ao iniciar o Expo:

```bash
cd mobile && DOMUS_API_URL=http://192.168.0.10:3333 npx expo start --clear
```

No PowerShell:

```bash
$env:DOMUS_API_URL="http://192.168.0.10:3333"; npx expo start --clear
```

Qual endereço usar:

| Onde o app roda | baseURL |
| --- | --- |
| Web (`npm run web`) e simulador iOS | `http://localhost:3333` |
| Emulador Android | `http://10.0.2.2:3333` |
| Celular físico com Expo Go | `http://<IP-da-sua-máquina>:3333` |

`localhost` dentro do celular é o próprio celular — em device físico use
sempre o IP da máquina na mesma rede Wi-Fi.

### Credenciais para teste

Vindas de `api/src/seed.ts`:

- `admin@domusapp.com` / `admin123` (ADMIN)
- `maria.sindica@email.com` / `123456` (MORADOR com `isSyndic: true`)

---

## Estrutura

```
mobile/
├── app.config.ts              baseURL da API via extra.apiUrl
└── src/
    ├── components/            Button, ConfirmSheet, Input, ModuleCard,
    │                          SectionHeader, StatusBanner, SummaryTile
    ├── config/modules.ts      catálogo dos 15 módulos do grid
    ├── contexts/AuthContext   sessão, login, logout, restauração
    ├── hooks/                 useAppFonts, useHomeSummary
    ├── navigation/            Stack (Login → Tabs) + placeholder "Em breve"
    ├── screens/               LoginScreen, HomeScreen, ProfileScreen,
    │                          ComingSoonScreen
    ├── services/              api.ts (axios + interceptors), authService,
    │                          noticeService, eventService, secureStorage
    ├── theme/                 colors, spacing/radius/elevation, typography
    ├── types/                 domínio (espelha o schema.prisma) e navegação
    └── utils/format.ts        saudação, rótulo de unidade, datas
```

Regras seguidas:

- **TypeScript estrito, sem `any`.**
- **Nenhum `fetch` dentro de tela** — tudo em `services/` ou hooks.
- **Nenhuma cor ou espaçamento literal em componente** — só tokens de `theme/`.
- **Um caminho por função**: cada módulo se abre pelo seu cartão na Home;
  o header e as abas não duplicam nenhuma dessas ações. Sair da conta é a
  exceção: mora na aba Perfil e tem um atalho no avatar do header da Home,
  que pede confirmação antes de encerrar a sessão.
- **Acessibilidade**: `accessibilityRole`/`accessibilityLabel` em todo elemento
  interativo e área de toque mínima de 44px (`layout.minTouchTarget`).

---

## TODO / limitações conhecidas

### 1. Morador comum não consegue logar (bloqueador da API)

`api/src/services/authService.ts` chama `hasPanelAccess()` no login e rejeita
quem não é `ADMIN`, `FUNCIONARIO` ou síndica (`isSyndic: true`). Um morador
comum recebe **401** com "Sua conta não tem acesso ao painel administrativo".

O app está pronto para o morador, mas hoje só entra quem tem acesso ao painel.
**TODO(API):** separar "acesso ao painel web" de "acesso ao app", liberando o
login para `MORADOR` com `status: 'ACTIVE'`.

### 2. Bloco/apartamento nem sempre aparece no header

- `POST /auth/login` devolve o usuário **sem** a relação `unit` (só `unitId`).
- `GET /users/me` devolve apenas o payload do JWT: `{ id, role }`.
- `GET /users/:id` traz a `unit`, mas é restrito a `ADMIN`/`FUNCIONARIO`.

`authService.withResolvedUnit()` tenta buscar a unidade e falha em silêncio
quando a API nega; nesse caso o header mostra o papel ("Síndica(o)",
"Morador(a)") no lugar do "Bloco A · 101".
**TODO(API):** fazer `GET /users/me` devolver o usuário completo com `unit` e
`condominium`.

### 3. Contagem de "não lidos" só existe na visão de morador

`GET /notices` devolve `isRead` por aviso apenas para morador comum. Para
perfis de painel a API manda `readCount`/`totalAddressees`, que não dizem se
*aquele* usuário leu. Por isso o bloco de resumo mostra "N comunicados
publicados" em vez de inventar um número de não lidos.

### 4. Módulos sem endpoint na API

Existem hoje: `/auth`, `/users`, `/notices`, `/units`, `/events`, `/votings`.

**Não existem** (o enunciado do projeto os cita, mas não há rota nem modelo no
`schema.prisma`): `/charges`, `/reservations`, `/visitors`, `/packages`,
`/notifications`, `/occurrences`, `/permissions`, além de documentos, multas,
achados e perdidos, pagamentos e histórico.

`GET /votings` existe, mas hoje só `ADMIN`/`FUNCIONARIO` podem listar — falta
liberar para morador e criar o endpoint de registro de voto.

Cada cartão do grid leva ao placeholder com a nota correspondente
(`src/config/modules.ts`).

### 5. Outros TODOs do app

- Telas próprias de Comunicados, Reservas, Acessos e Encomendas.
- Push notifications.
- No target **web** o token cai em `localStorage`, porque `expo-secure-store`
  não existe no browser (`src/services/secureStorage.ts`). O alvo de entrega é
  o app nativo; o web serve só para desenvolvimento.
