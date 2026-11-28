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

**Site settings → Environment variables** → adicione as quatro:

| Nome | Valor | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do passo 1 | público |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key | público |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | **segredo** — marque como sensível |
| `NEXT_PUBLIC_SITE_URL` | endereço do site, ex.: `https://seu-site.netlify.app` (sem barra no fim) | público — sem ela, os links de definir senha e de acompanhamento da OS não são gerados |

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

### Criação de loja

| Sintoma | Causa | Solução |
|---|---|---|
| No detalhe da loja, **"Senha do Dono: A loja não tem Dono ativo"** logo após criar | A criação tem 3 etapas (criar loja → criar usuário do Dono no Auth → gravar o vínculo `membros`); se a 3ª falha (engasgo transitório de rede entre a função serverless e o Supabase), o rollback pode não completar e sobra uma **loja órfã**: existe, com o usuário do Dono criado, mas sem a linha em `membros` | Conferir no banco (`membros` da loja vazio, usuário do Dono existe no Auth). Consertar gravando o membro que faltou (`insert into membros (loja_id, user_id, nome, perfil) values (…, …, …, 'dono')` com a service role) e gerar novo link; **ou** apagar a loja órfã (sem membros nada trava o cascade) e recriar. Recriar costuma ir limpo — a falha é transitória, não um defeito |

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
| `getByRole('region', { name: 'Quanto sobrou' })` não acha o bloco | O `Cartao` é uma `<section>` **sem nome acessível**, então não vira "region" | Localizar pela seção que contém o título: `page.locator('section').filter({ has: page.getByRole('heading', { name: '…' }) })` |
| Teste de banco (pgTAP) que passava começa a falhar depois de rodar o e2e ou de testar na mão | O teste **conta linhas do banco inteiro** (`count(*)` fora da sessão de um usuário) e pega dados reais deixados pelo e2e | Todo `count`/`update` feito como servidor no teste filtra pela loja ou OS **criada no próprio teste** |

### Fase C do Serviço (link do cliente, WhatsApp, garantia)

| Sintoma | Causa | Solução |
|---|---|---|
| Em produção a página da OS dá "This page couldn't load" | `NEXT_PUBLIC_SITE_URL` não configurada; a montagem de links falha de propósito sem ela (para não gerar link com domínio forjado) | Configurar a variável no Netlify (passo 4). Desde a Fase C a página não cai mais: o cartão "Avisar cliente" só avisa que o link não está disponível |
| Mudança de CSS (token novo) não aparece no `next dev`, ou a página diz que uma função exportada "is not a function" | `next dev` aberto há muito tempo, com cache velho, parou de recarregar | Encerrar o `next dev` e subir de novo (o Next não deixa dois na mesma pasta). Para conferir sem mexer nele: `npm run build` e `npx next start -p 3102` |
| Teste no navegador "acha" blocos de outra página (ex.: Orçamento numa OS de garantia) | Depois de navegar, o Next guarda a página anterior **escondida** no DOM | Conferir pelo que está visível (captura de tela) ou procurar dentro do conteúdo da página atual |
| Folha impressa (termo) sai com texto claro em papel branco | Componente usou os tokens normais, que no tema escuro são claros | Documento impresso usa os tokens `folha` / `sobre-folha`, que são claros nos dois temas |

### Fase B do Serviço (orçamento, peças, pagamento, entrega)

| Sintoma | Causa | Solução |
|---|---|---|
| `db push` recusa as migrações ("inserted before the last migration") | Uma migração foi aplicada com número **maior** que outras criadas depois dela | Nunca criar migração com número menor que a última aplicada. Se já aconteceu no local, **renumerar as seguintes** para depois dela (foi o que se fez com `090700`/`090800`), em vez de resetar o banco |
| Depois de trocar de branch, `npm test` falha com "Cannot find module 'vite-tsconfig-paths'" | Uma branch removeu o pacote da `node_modules`; a outra ainda o usa | Rodar `npm install` sempre que trocar de branch |
| Atendente consegue ler o lucro/custo da OS pela API, mesmo a tela escondendo | O valor estava numa **coluna** de uma tabela que todos os perfis leem; esconder na tela não protege | Valor só do Dono vai para **tabela própria** com RLS `meu_perfil() = 'dono'` (`os_pecas_custo`, `os_fechamento`), no padrão de `servicos_custo` |
| Gatilho que "libera" gravação quando uma variável de sessão está ligada não protege nada | `set_config`/`set local` pode ser chamado por **qualquer** usuário logado | Liberar por **quem roda**: função `security definer` (roda como servidor) + gatilho que barra só `current_user in ('authenticated','anon')` |
| Usuário de uma loja consegue pendurar item no orçamento de outra loja | O filho estava ligado ao pai por um vínculo **simples** (`orcamento_id`); a RLS confere só o `loja_id` do próprio filho | Vínculo **composto** `(pai_id, loja_id) → pai (id, loja_id)`: o filho só se liga a pai da mesma loja |
| Formulário de um bloco não reflete o dado novo depois de salvar (ex.: valor do pagamento não vem preenchido quando a OS fica pronta) | O estado inicial do `useState` só é lido na **primeira** montagem; o `refresh()` traz dados novos mas o componente não reinicia | Dar ao bloco uma `key` com o que deve reiniciá-lo (versão do orçamento, status da OS, custo da peça) |
| Na nuvem, a tela de OS dá erro ao abrir orçamento, peças ou pagamento | As migrações da Fase B (`20261126*`) ainda **não subiram** para o Supabase da nuvem | Depois do merge: `npx supabase link --project-ref <ref>` e `npx supabase db push` (passo 3). Conferir com `select table_name from information_schema.tables where table_name like 'os_%'` |

---

## Senha do aparelho — o que a cifra protege, e o que NÃO protege

A senha do aparelho que o cliente deixa na loja é guardada cifrada em `os_senha_aparelho.senha_cifrada` (`pgp_sym_encrypt` com chave derivada do Supabase Vault), lida só pela função `senha_aparelho(os uuid)` e apagada automaticamente quando a OS é encerrada (`entregue` ou `devolvido`). Nada disso aparece na tela até o Dono ou o técnico clicar em "Mostrar senha".

**O que a cifra protege:**

- **Vazamento de backup/dump do banco** — sem a chave do Vault, o dump só tem bytes cifrados.
- **Outra loja** — a RLS esconde a linha, e mesmo com a linha em mãos a função `senha_aparelho` confere a loja da sessão.
- **Atendente** — a função `senha_aparelho` devolve `null` para quem não é Dono nem técnico.
- **Admin em suporte (`em_suporte()`)** — mesma recusa; confirmado por teste pgTAP.
- **`service_role` (a chave usada no servidor Netlify e nos scripts admin)** — a função `chave_senha_aparelho()` tem `EXECUTE` revogado inclusive do `service_role`; o `revoke` na tabela `os_senha_aparelho` fecha o caminho direto. Ou seja, nem o próprio backend lê a senha do aparelho.

**O que a cifra NÃO protege (e você, o Filipe, precisa saber):**

1. **Superusuário do Postgres.** Pelo editor SQL do Supabase (que roda como `postgres`), você lê a chave do Vault e a tabela `os_senha_aparelho`. Isso é desenho: superusuário manda no banco. O balcão fica protegido do usuário interno (atendente) e do suporte; não do dono do projeto Supabase.
2. **Sem rotação de chave.** A chave é gerada uma vez na primeira migração. Se vazar a chave do Vault, a troca exige regerar a chave e reescrever a cifra de todas as OS abertas — não há script pronto. Mitigação natural: OS encerrada apaga a senha, então o buraco se fecha com a conclusão dos reparos.
3. **Perda em restore sem a chave-raiz do Vault.** Um restore sem a mesma chave-raiz deixa as senhas cifradas ilegíveis. O pior caso é o lojista pedir a senha ao cliente de novo nas OS abertas.

Antes do merge em produção, confirme no painel do Supabase hospedado (SQL Editor, logado como `postgres`):

```sql
-- authenticated e anon não devem ter USAGE no schema vault
select nspname, has_schema_privilege('authenticated', nspname, 'USAGE') as authenticated,
                 has_schema_privilege('anon',           nspname, 'USAGE') as anon
from pg_namespace where nspname = 'vault';
-- Esperado: authenticated=false, anon=false.
```

Se qualquer um der `true`, pare o merge e chame pelo canal de suporte do Supabase antes de prosseguir.

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
