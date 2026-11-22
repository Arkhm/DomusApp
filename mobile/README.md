# DomusApp — Mobile

App do morador do DomusApp, em Expo + React Native + TypeScript.
Consome a API REST do monorepo (`../api`).

## Funcionalidades atuais

O app utiliza os dados da API. O grid da Home oferece oito acessos:
Comunicados, Eventos, Votações, Cobranças, Reservas, Ocorrências,
Notificações e Veículos e pets. As abas são Início, Reservas, Cobranças e Perfil.
Visitantes, portaria e encomendas não fazem parte do menu atual.

- Login, restauração e renovação de sessão; tokens no SecureStore no app nativo.
- Comunicados e eventos com telas de lista/detalhe e controle de leitura.
- Votações com participação por unidade e visibilidade dos resultados conforme a API.
- Cobranças com detalhes, instruções Pix e acompanhamento dos estados de pagamento.
- Solicitação e cancelamento das próprias reservas; acompanhamento da avaliação.
- Registro de ocorrências e acompanhamento da resposta e do status.
- Caixa de notificações internas com leitura e navegação ao conteúdo.
- Consulta e gestão de veículos e pets conforme as permissões e limites da unidade.
- Perfil, identificação da unidade e encerramento da sessão.

Não há autocadastro: a administração cria a conta no painel e fornece as
credenciais iniciais. Em “Esqueci minha senha”, o morador informa o e-mail
cadastrado, recebe um link e define a nova senha no navegador. Depois volta
ao app para entrar. O link vale uma hora, só pode ser usado uma vez e a
redefinição revoga as sessões anteriores. A confirmação da solicitação é genérica.

O envio real depende de SMTP configurado na API; sem SMTP em desenvolvimento,
o Ethereal captura as mensagens sem entregá-las. Veja a seção de recuperação
por e-mail no [README principal](../README.md#recuperação-de-senha-por-e-mail).

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
    ├── config/modules.ts      catálogo dos oito acessos do grid
    ├── contexts/AuthContext   sessão, login, logout, restauração
    ├── hooks/                 useAppFonts, useHomeSummary
    ├── navigation/            Stack de autenticação, recuperação e telas do morador
    ├── screens/               LoginScreen, HomeScreen, ProfileScreen,
    │                          ForgotPasswordScreen e telas dos módulos
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

## Limitações e validação

- As notificações são internas; não há push com o aplicativo fechado. A caixa
  persistente de cobranças, reservas e votações depende do `notification-worker`,
  executado separadamente da API. Não é um histórico completo das transições.
- O ambiente de teste Pix não quita a dívida por aprovação simulada. A API
  diferencia o estado da tentativa de pagamento do estado da cobrança.
- O alvo de entrega é o app nativo. No target web de desenvolvimento, o
  armazenamento usa `localStorage` porque SecureStore não está disponível.
- Falhas de rede têm tratamento na interface; não existe sincronização completa
  para operar offline. Ações e permissões continuam sendo validadas pela API.
- A entrega exige validação dos fluxos em aparelho e no endereço público após
  hospedar; checagem de tipos e export não substituem essa homologação.

Os endpoints utilizados incluem `/auth`, `/notices`, `/events`, `/votings`,
`/invoices`, `/common-areas`, `/reservations`, `/incidents`, `/notifications`,
`/vehicles` e `/pets`. Consulte o Swagger para contratos e permissões.
Contas de síndico veem apenas os próprios registros de reservas e ocorrências
neste canal, mesmo quando a API permite uma visão administrativa.

Para testar o e-mail em celular físico, `FRONTEND_URL` na API precisa apontar
para o web acessível pelo aparelho (IP LAN local ou URL pública HTTPS).
`DOMUS_API_URL` aponta para a API, não para a página de redefinição. Alinhe
`VITE_API_URL` e CORS com os endereços acessíveis. Mudanças no ambiente da API
via Docker exigem recriar o contêiner, não apenas reiniciá-lo.

## Perfil e sessão atuais

O login aceita qualquer conta ACTIVE. Após o login e ao restaurar a sessão, o app consulta `GET /auth/me` e salva o perfil atualizado com unidade no SecureStore. Não depende de `GET /users/:id`. Um access token expirado dispara refresh e uma única repetição da consulta; sessão inválida limpa a autenticação. Falhas de rede/servidor preservam o perfil disponível para uso offline, sem conceder permissões adicionais na API.
