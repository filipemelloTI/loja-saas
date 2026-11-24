# Loja SaaS — Guia de publicação

Como colocar a plataforma no ar (Supabase na nuvem + Netlify) e criar a primeira loja
de verdade. O produto é white-label: o cliente (o cunhado) só vê o WhatsApp e o painel
da loja; ele não sabe nem precisa saber da infraestrutura.

A fundação já foi testada ponta a ponta localmente (`npm run test:e2e`): admin cria
loja → Dono define senha → menu certo por plano e por perfil. Falta só publicar.

---

## O que falta (passos do Filipe)

Estes passos usam **suas** contas e senhas. O executor (Claude) **não** cria conta, não
digita senha e não publica no seu lugar — ele te guia. Faça nesta ordem:

1. **Criar o projeto no Supabase** (nuvem), região **São Paulo (`sa-east-1`)**. Guarde a
   **senha do banco**.
2. **Conectar o repositório ao Netlify** (New site → import do Git) — framework Next.js.
3. No seu computador, **ligar o projeto local ao da nuvem e subir o banco**:
   `npx supabase link` e `npx supabase db push`.
4. No Netlify, cadastrar as **três variáveis de ambiente** (abaixo).
5. No Supabase, em **Authentication**: pôr a **URL do site** e as **URLs de redirecionamento**
   iguais ao domínio do Netlify, e **desligar o cadastro público** (só convite via admin).
6. Criar o **admin da plataforma em produção**: seu usuário no Supabase Auth + uma linha em
   `admins_plataforma` (SQL no painel).
7. Criar o **plano Completo** em produção (SQL no painel) — sem ele o seletor de plano fica
   vazio e não dá para criar loja.
8. Entrar no site publicado, **criar a loja do cunhado** (plano Completo), gerar o link do
   Dono e **conferir o login no celular** dele.

O detalhe de cada passo está abaixo. Onde aparecer **[conta sua]**, é um passo que só você
faz.

---

## Passo a passo

### 1. Projeto no Supabase (nuvem) — [conta sua]

1. Entre em <https://supabase.com> → **New project**.
2. Região: **South America (São Paulo) — `sa-east-1`** (mais perto, menos latência).
3. Defina e **guarde a senha do banco** (vai precisar no `supabase link`).
4. Espere o projeto subir. Em **Project Settings → API**, anote:
   - **Project URL** (ex.: `https://xxxx.supabase.co`) → vira `NEXT_PUBLIC_SUPABASE_URL`.
   - **anon / public key** → vira `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **service_role key** (em *Project API keys*, botão *Reveal*) → vira
     `SUPABASE_SERVICE_ROLE_KEY`. **Segredo**: nunca vai para o navegador nem para o Git.

### 2. Conectar ao Netlify — [conta sua]

1. <https://app.netlify.com> → **Add new site → Import an existing project** → seu Git.
2. Framework: **Next.js** (o Netlify detecta sozinho). Build: `npm run build`.
3. Pode concluir o primeiro deploy; ele vai falhar/ficar incompleto até as variáveis do
   passo 4 existirem — normal.
4. Anote o **domínio** que o Netlify deu (ex.: `https://sua-loja.netlify.app`). É ele que
   vai nas URLs de Auth (passo 5).

### 3. Subir o banco para a nuvem

No seu computador, na pasta do projeto:

```bash
npx supabase login          # [conta sua] abre o navegador para autorizar o CLI
npx supabase link --project-ref <ref-do-projeto>   # pede a senha do banco (passo 1)
npx supabase db push        # aplica todas as migrações em supabase/migrations
```

O `<ref-do-projeto>` é o pedaço do Project URL (`https://<ref>.supabase.co`).
O `db push` **não** roda o `seed.sql` (ele é só para desenvolvimento local): em produção
os dados — admin, planos, lojas — são criados pelos passos 6, 7 e 8.

### 4. Variáveis de ambiente no Netlify — [conta sua]

**Site settings → Environment variables** → adicione as três:

| Nome | Valor | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do passo 1 | público |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key | público |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **segredo** — marque como sensível |

Depois de salvar, **refaça o deploy** (Deploys → Trigger deploy → Deploy site) para o build
pegar as variáveis.

### 5. Autenticação no Supabase — [conta sua]

Em **Authentication → URL Configuration**:

- **Site URL**: o domínio do Netlify (passo 2), ex.: `https://sua-loja.netlify.app`.
- **Redirect URLs**: adicione o mesmo domínio (e, se usar, `https://.../definir-senha`).

Em **Authentication → Providers → Email** (ou *Sign In / Up*):

- **Desligue o cadastro público** (*Enable signups* **off**). Ninguém se cadastra sozinho;
  todo usuário entra por convite — o admin cria a loja/o Dono, o Dono cria a equipe, e cada
  um recebe o **link de definir senha**.
- Confirmação de e-mail pode ficar ligada; como os usuários são criados pela service role
  com `email_confirm: true`, eles já entram direto pelo link.

### 6. Admin da plataforma em produção — [conta sua]

1. **Authentication → Users → Add user**: crie o **seu** usuário (e-mail + senha). Copie o
   **UUID** dele (coluna *UID*).
2. **SQL Editor** → rode (troque o UUID):

   ```sql
   insert into public.admins_plataforma (user_id)
   values ('<uuid-do-seu-usuario>');
   ```

3. Entre no site publicado com esse e-mail/senha. Você deve cair direto em **/plataforma**
   (o painel). Se cair em outra tela, confira se o UUID da linha bate com o do usuário.

### 7. Plano Completo em produção — [conta sua]

O `db push` **não** roda o `seed.sql`, então em produção a tabela `planos` nasce vazia e o
seletor de plano da tela "Nova loja" fica sem opção. Crie o plano Completo uma vez, no
**SQL Editor** do Supabase:

```sql
insert into public.planos (nome, modulos, limite_usuarios)
values ('Completo', '{servico,estoque,vendas,fornecedores,financeiro}', 5);
```

Pode criar outros planos depois pela própria tela (**Planos**, no painel) ou repetindo o
`insert` com outro nome/limite/módulos.

### 8. Loja do cunhado — [conta sua]

1. No painel, **Nova loja**: nome da loja, plano **Completo**, nome e e-mail do Dono (o
   cunhado). Confirme os módulos (o plano Completo já marca todos).
2. Ao criar, aparece o **link de definir senha**. Copie e mande para o cunhado **pelo
   WhatsApp**. O link vale ~1 hora e só funciona uma vez.
3. No celular, o cunhado abre o link, define a senha e já entra na loja. Confira com ele que
   o menu aparece (Início, Serviço, Clientes, Estoque, Vendas, Fornecedores, Financeiro,
   Configurações) e que ele consegue abrir **Configurações**.
4. Se o link vencer, gere outro: painel → a loja → **Senha do Dono → Gerar novo link**.

Pronto. A partir daí o cunhado administra a própria equipe em **Configurações → Usuários**.

---

## Pegadinhas (sintoma → causa → solução)

Tudo que mordeu durante a montagem. Formato do projeto: **sintoma → causa → solução**.

### Next.js 16

| Sintoma | Causa | Solução |
|---|---|---|
| Página depende da sessão mas o build reclama de dados dinâmicos / tudo tenta ser estático | Next 16 com **Cache Components** (`cacheComponents: true`) prerenderiza por padrão | Pôr o que lê a sessão atrás de `<Suspense>` com um esqueleto; o conteúdo dinâmico é *server-streamed* (é o que já está feito no shell da loja e nos painéis) |
| `middleware.ts` não roda / não é reconhecido | No Next 16 o *middleware* foi renomeado para **`proxy`** | Arquivo `src/proxy.ts` exportando `proxy()` e `config.matcher` |
| Erro de "config precisa ser estático" no matcher do proxy | O Next exige que `config.matcher` seja literal; e o regex precisa escapar os pontos | Manter o padrão em `src/lib/matcher.ts` (testado) e repetir **idêntico** no `proxy.ts`; escapar `\\.` em `favicon\\.ico`, `manifest\\.webmanifest` e nas extensões de imagem |
| Em produção o usuário loga e a URL fica em `/` em vez de `/plataforma` | *Server Action* faz `redirect('/')` e o proxy redireciona `/`→`/plataforma`; o roteador do cliente mostra a URL antiga, mas **renderiza o destino certo** | Comportamento do Next, não é bug da app: o conteúdo é o do destino. No e2e a asserção é pelo conteúdo da tela, não pela URL |

### Supabase (local e CLI)

| Sintoma | Causa | Solução |
|---|---|---|
| Depois de `supabase db reset` os usuários somem e só sobra o admin | O `reset` recria o banco e roda **só** `seed.sql`; usuários criados à mão pela tela se perdem | Em dev, contar só com o que está no `seed.sql` (`admin@local.test` / `admin123`). Os testes e2e **semeiam o que precisam** pela service role (`tests/e2e/global-setup.ts`), não dependem de usuário criado à mão |
| `supabase link` / `db push` pede chave e a antiga não serve | O **CLI 3.x** mudou: autentica por `supabase login` (access token) e o `link` pede a **senha do banco**, não a chave da API | `npx supabase login` primeiro; no `link`, usar a **senha do banco** definida ao criar o projeto. As chaves `anon`/`service_role` são só para a aplicação (variáveis do Netlify), não para o `link` |
| Em produção o seletor de plano em "Nova loja" nasce **vazio** e não dá para criar loja | O único `insert into planos` fora dos testes está no `seed.sql`, que **não** roda no `db push` | Criar o plano Completo por SQL no painel (passo 7) antes de criar a loja; admin e lojas também são criados à mão (passos 6 e 8), não automaticamente |

### UI / navegador

| Sintoma | Causa | Solução |
|---|---|---|
| Campos de um formulário desabilitado continuam clicáveis/editáveis | Só o `<fieldset disabled>` desabilita de verdade os filhos; aplicar `.disabled` num pai **não** cascateia | Usar `<fieldset disabled={somenteLeitura}>` em volta dos campos (é o que o modo suporte e os formulários de Configurações fazem) |
| Botão **Copiar** do link não copia (no painel de pré-visualização) | `navigator.clipboard` é bloqueado em iframes/pré-visualização sem permissão | A `CaixaLink` trata o erro: se o clipboard falhar, ela **seleciona o texto** do campo para o usuário copiar na mão (Ctrl+C). No navegador normal (produção) o Copiar funciona |

### Testes end-to-end (Playwright, contra o `next dev`)

| Sintoma | Causa | Solução |
|---|---|---|
| O formulário envia como **GET com os campos na URL** e nada acontece | Clicou no *submit* antes da **hidratação**; sem o React montado, o `onSubmit`/`preventDefault` não existe e o navegador faz o submit nativo | Esperar a hidratação antes de clicar (`networkidle` + folga). Em formulários com `<select>`/checkbox controlados, só mexer **depois** de hidratar, senão o React redefine o estado inicial |
| A página não hidrata; chunks `/_next/...` bloqueados | O `next dev` bloqueia recursos de dev vindos de **outra origem**; apontar o teste para `127.0.0.1` conta como cross-origin | Usar **`localhost`** como host do servidor de teste (é o que o `playwright.config.ts` faz), ou liberar `allowedDevOrigins` no `next.config` |
| A tela de **definir senha** aparece e some; o campo some antes de preencher | Em dev o React (Strict Mode) roda o efeito **duas vezes** e a 2ª chamada consome o token de **uso único**, caindo em "link inválido" | Em produção (sem Strict Mode) o link funciona de primeira. No e2e, se a tela não estabiliza, o teste **gera um link fresco** pela service role e repete |
| `next dev` responde **500 "Jest worker"** numa porta | Servidor de dev com cache velho travado | Subir um `next dev` novo em **outra porta** e apontar o `baseURL`/`webServer` do Playwright para ela (o config usa a porta `3100` por padrão) |

---

## Rodar os testes (referência)

```bash
npm test             # unidades (vitest) — regras puras
npx supabase test db # RLS e triggers (pgTAP), com o Supabase local no ar
npm run test:e2e     # ponta a ponta (Playwright) — sobe o next dev sozinho na 3100
npm run build        # confere o build de produção
```

O e2e precisa do **Supabase local no ar** (`npx supabase start`) e do `.env.local` com a
`SUPABASE_SERVICE_ROLE_KEY` (o `global-setup` usa para semear admin e plano). Se os
navegadores do Playwright não estiverem instalados: `npx playwright install chromium`.
