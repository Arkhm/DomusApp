# DomusApp — Mobile

App do morador do DomusApp, em Expo + React Native + TypeScript.
Consome a API REST do monorepo (`../api`).

Esta rodada entrega Login, Home (dashboard), Reservas e Ocorrências. Os demais
módulos aparecem no grid e levam a um placeholder "Em breve" que explica o que
ainda falta do lado da API.

---

## O que está pronto

| Item | Situação |
| --- | --- |
| Login com e-mail + senha | ✅ integrado a `POST /auth/login` |
| Validação de campos, loading, erro de credencial, erro de rede | ✅ |
| Token em `expo-secure-store` (Keychain / EncryptedSharedPreferences) | ✅ |
| Sessão restaurada ao abrir o app | ✅ consulta perfil atualizado via `GET /auth/me` |
| Home com saudação + identificação do morador | ✅ |
| Resumo do topo (comunicados e próximo evento) | ✅ `GET /notices` + `GET /events` |
| Grid com os 15 módulos | ✅ (Reservas e Ocorrências prontas; demais em "Em breve") |
| Bottom tabs: Início / Reservas / Acessos / Encomendas / Perfil | ✅ (Acessos e Encomendas são placeholders) |
| Comportamento com a API fora do ar | ✅ banner de erro + "Tentar de novo" |
| Design tokens centralizados, fonte Inter, alvo 390×844 | ✅ |

Sem link de "Criar conta": moradores são cadastrados pela administração no
painel web. "Esqueci minha senha" abre um aviso orientando a procurar a
administração do condomínio: a redefinição de senha é feita sempre por ela,
não pelo app.

---

## Como rodar

Pré-requisitos: Node **22.13+** na linha 22, **24.3+** na linha 24 ou **26+**,
e o app **Expo Go compatível com SDK 58** no celular (ou um emulador
Android / simulador iOS). O projeto usa Expo SDK 58; a versão do Expo Go
precisa aceitar esse SDK.

```bash
cd mobile
npm ci
```

```bash
npm start
```

Para celular físico, configure `DOMUS_API_URL` conforme a seção abaixo antes
de iniciar o Expo. Depois escaneie o QR Code com o Expo Go, ou use:

```bash
npm run android
```

```bash
npm run ios
```

```bash
npm run web
```

Checagens locais, executadas dentro de `mobile/`:

```bash
npx expo install --check
npx expo-doctor@latest
npx tsc --noEmit
node --test src/utils/residentForms.test.cjs
npx expo export --platform android
```

O export verifica o empacotamento Android e grava os artefatos em `dist/`,
ignorado pelo Git. A validação no aparelho deve conferir login, restauração
da sessão, logout, navegação, fontes, comunicados/notificações, reservas,
ocorrências, votações, cobranças e veículos/pets.

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
export DOMUS_API_URL=http://192.168.0.10:3333
npx expo start --clear
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

Substitua `192.168.0.10` pelo IP atual do computador. Para verificar a conexão,
abra `http://<IP-da-sua-máquina>:3333/api/status` no navegador do celular.
Ao trocar a URL, reinicie o Expo com `--clear`. Não é necessário recriar
o banco ou os containers para atualizar o SDK do mobile.

### Credenciais para teste

Vindas de `api/src/seed.ts`:

- `admin@domusapp.com` / `admin123` (ADMIN)
- `maria.sindica@email.com` / `123456` (MORADOR com `isSyndic: true`)
- `fernando@email.com` / `123456` (MORADOR sem acesso ao painel)

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

### 3. Contagem de "não lidos" só existe na visão de morador

`GET /notices` devolve `isRead` por aviso apenas para morador comum. Para
perfis de painel a API manda `readCount`/`totalAddressees`, que não dizem se
*aquele* usuário leu. Por isso o bloco de resumo mostra "N comunicados
publicados" em vez de inventar um número de não lidos.

### 4. Módulos sem endpoint na API

Existem hoje: `/auth`, `/users`, `/notices`, `/units`, `/events`, `/votings`,
`/common-areas`, `/reservations` e `/incidents`.

**Reservas e Ocorrências estão prontas no mobile:**

- Reservas: lista das próprias reservas com status e motivo de rejeição; nova
  solicitação com área ativa; cancelamento de PENDING/APPROVED futura com confirmação.
  Datas `YYYY-MM-DD` e horários `HH:mm` são validados no fuso de Brasília (UTC-03 fixo),
  sem dependências novas. Erros da API, inclusive conflito 409, aparecem na tela.
- Ocorrências: lista das próprias ocorrências com categoria, status e resposta da
  administração; registro com título (até 200), descrição e categoria.
  Autor e unidade vêm da API, nunca do formulário.
- Reservas abre pela aba e pelo cartão da Home; Ocorrências abre pelo cartão da Home.
  Contas de síndico também veem apenas os próprios registros neste canal.

Os testes de validação rodam em `mobile/` com
`node --test src/utils/residentForms.test.cjs`, usando o runner nativo do Node e o
TypeScript já instalado. A checagem de tipos continua com `npx tsc --noEmit`.
A integração em aparelho e as notificações de mudança de status ficam de fora desta entrega.

**Ainda não existem**: `/charges`, `/visitors`, `/packages`, `/notifications`,
`/permissions`, além de documentos, multas, achados e perdidos, pagamentos e histórico.

`GET /votings` já é liberado para morador e `POST /votings/:id/votes` registra
um voto por unidade. Falta a tela de votações no app.

Os demais cartões do grid levam ao placeholder com a nota correspondente
(`src/config/modules.ts`).

### 5. Outros TODOs do app

- Telas próprias de Comunicados, Acessos e Encomendas.
- Push notifications.
- No target **web** o token cai em `localStorage`, porque `expo-secure-store`
  não existe no browser (`src/services/secureStorage.ts`). O alvo de entrega é
  o app nativo; o web serve só para desenvolvimento.

## Perfil e sessão atuais

O login aceita qualquer conta ACTIVE. Após o login e ao restaurar a sessão, o app consulta `GET /auth/me` e salva o perfil atualizado com unidade no SecureStore. Não depende de `GET /users/:id`. Um access token expirado dispara refresh e uma única repetição da consulta; sessão inválida limpa a autenticação. Falhas de rede/servidor preservam o perfil disponível para uso offline, sem conceder permissões adicionais na API.
