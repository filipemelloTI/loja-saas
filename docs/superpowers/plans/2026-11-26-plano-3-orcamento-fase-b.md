# Plano 3 — Fase B do módulo Serviço/OS: Orçamento, peças, pagamento, comissão e lucro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo da OS: montar orçamento com itens do catálogo e peças (do estoque ou "a comprar"), registrar aprovação manual pelo atendente, cobrar sinal e saldo, baixar estoque na entrega, calcular comissão do técnico e lucro da OS, tudo congelado no momento da entrega.

**Architecture:** Toda consistência (versão do orçamento, baixa de estoque, congelamento de comissão, soma de pagamentos) vive em funções SQL `security invoker` — o supabase-js não tem transações. O cliente da sessão chama RPC; o TS puro em `src/lib/` cuida de montagem, validação e tradução de erros. Telas seguem o design system em `DESIGN.md` (`.sobrancelha`, `.numeros`, `.realce`, `.vidro`), com `useFormStatus` para pending state.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase (Postgres + RLS + pgTAP), Zod, Vitest, Playwright, Tailwind 4.

**Spec:** `C:\Users\Usuário\Desktop\Projetos\master-iphone\docs\superpowers\specs\2026-11-22-sistema-completo-design.md` — seções 8.4, 8.5, 8.6 e as decisões em 13.2/13.3.

## Global Constraints

- **Aprovação do cliente nesta fase é manual pelo atendente**, não há link público; o botão "Aprovado" pede nome de quem aprovou e meio (balcão / telefone / WhatsApp fora do sistema) — vira observação de versão.
- **Peça sem estoque:** o atendente pode aprovar o orçamento mesmo assim; a peça entra como "a comprar", custo fica pendente para o Dono preencher. A entrega **não** é bloqueada por peça a comprar.
- **Congelamento na entrega:** no momento em que a OS vira `entregue`, o sistema grava custo total das peças, comissão calculada e lucro em colunas da OS; mudanças posteriores de % de comissão ou preço de peça **não** alteram OS já entregue.
- **Comissão = % técnico × (total cobrado com desconto − custo das peças).** Lucro = total cobrado − custo peças − comissão. Dono vê, técnico vê só a própria se o Dono ligar (já em `comissoes_membro`).
- **Baixa de estoque é na entrega**, não na aprovação. Peça aprovada que a loja tem no estoque só sai do estoque quando o aparelho sai.
- **Formas de pagamento** vêm de `config_loja.formas_pagamento`; a OS pode combinar várias (Pix + crédito 2x, por exemplo).
- **Sinal:** opcional na aprovação; abatido do saldo na entrega.
- **Nova versão do orçamento:** editar orçamento aprovado cria nova versão, volta status para `orcamento_enviado` e descarta a aprovação anterior. Versões anteriores ficam no histórico.
- **RLS:** toda tabela nova habilita RLS com `minha_loja()` + `loja_liberada()` + `not em_suporte()`, no padrão de `ordens_servico`. `security invoker` em todas as funções.
- **TRUNCATE revogado** nasce por `default privileges` da Fase A — tabelas novas já herdam.
- **Design system Gestow (`loja-saas/DESIGN.md`)** é obrigatório — ler antes de criar qualquer tela.

## Review Focus

- **Peça "a comprar" sem custo e OS entregue:** se o Dono esquecer de preencher o custo, a entrega calcularia lucro usando custo zero e inflaria comissão. Pinar em testes: a entrega **bloqueia** se há peça a comprar com custo pendente.
- **Mudança de orçamento aprovado por dois atendentes ao mesmo tempo:** a segunda edição deve criar versão 3, não sobrescrever a versão 2 do primeiro. Pinar com `de_versao` em `editar_orcamento_os` (optimistic concurrency, mesmo padrão de `mudar_status_os`).
- **Entrega concorrente:** dois cliques em "Entregar" não podem baixar estoque duas vezes. Pinar com `for update` em `ordens_servico` dentro de `entregar_os` + checagem `encerrada_em is null`.
- **Pagamento somado maior que o total:** se atendente digita Pix 300 + crédito 400 numa OS de 650, o sistema aceita ou corrige? Pinar: aceita até `total`, recusa acima com mensagem clara.
- **Técnico trocado antes da entrega:** se a OS troca de técnico entre aprovação e entrega, qual % vale? Pinar: a % vigente **no técnico que está no momento da entrega**, congelada ali.

---

## Estrutura de arquivos

**Novo em `supabase/migrations/`:**
- `20261126090100_orcamentos.sql` — tabelas `os_orcamentos`, `os_orcamento_itens`, `os_orcamento_versoes`; RLS; triggers de versão.
- `20261126090200_os_pecas.sql` — tabela `os_pecas` (peças da OS, do estoque ou a comprar), FK para `estoque_itens` opcional; RLS.
- `20261126090300_os_pagamentos.sql` — tabela `os_pagamentos` (linha por forma de pagamento usada); RLS.
- `20261126090400_aprovar_recusar.sql` — RPCs `aprovar_orcamento_os`, `recusar_orcamento_os`, `editar_orcamento_os` (cria nova versão).
- `20261126090500_entregar_os.sql` — RPC `entregar_os` (congela custos + comissão + baixa estoque + grava pagamento final).
- `20261126090600_colunas_encerramento.sql` — adiciona em `ordens_servico`: `custo_pecas_congelado`, `comissao_congelada`, `lucro_congelado`, `tecnico_congelado_id`.

**Novo em `src/lib/`:**
- `orcamento.ts` — montagem, cálculo de total/comissão/lucro, validação de pagamentos.
- `pecas.ts` — regras de peça do estoque vs a comprar.
- `pagamento.ts` — soma de formas, validação de sinal.

**Novo em `src/app/(loja)/servico/[id]/`:**
- `_componentes/orcamento.tsx` — bloco de orçamento no detalhe da OS.
- `_componentes/pecas.tsx` — bloco de peças.
- `_componentes/pagamento.tsx` — bloco de pagamento.
- `_componentes/entregar.tsx` — botão + diálogo de entrega.

**Novo em `src/app/(loja)/servico/acoes.ts`:**
- `aprovarOrcamentoAcao`, `recusarOrcamentoAcao`, `editarOrcamentoAcao`, `registrarPagamentoAcao`, `entregarOSAcao`.

**Modificar:**
- `src/app/(loja)/servico/[id]/page.tsx` — compor os 4 blocos novos.
- `src/lib/os-status.ts` — nenhuma mudança no enum, só garantir que `avancosDe` cobre `aprovado → aguardando_peca` e `pronto → entregue`.

---

## Task 1 — Schema do orçamento

**Files:**
- Create: `supabase/migrations/20261126090100_orcamentos.sql`
- Test: `supabase/tests/orcamentos.test.sql`

**Interfaces:**
- Produces: tabelas `public.os_orcamentos`, `public.os_orcamento_itens`, `public.os_orcamento_versoes`. Status do orçamento: enum `status_orcamento` (`rascunho`, `enviado`, `aprovado`, `recusado`, `substituido`). Cada OS tem no máximo 1 orçamento vigente (`status in ('rascunho','enviado','aprovado')`) e várias versões antigas (`substituido`, `recusado`).

- [ ] **Step 1: Escrever o teste pgTAP**

Criar `supabase/tests/orcamentos.test.sql` com asserts:
- `os_orcamentos` tem RLS ligada.
- `unique (os_id) where status in ('rascunho','enviado','aprovado')` impede dois vigentes.
- Dono A não lê orçamento de loja B.
- Trigger `orcamento_atualizado_em` mexe em `atualizado_em`.
- Inserir item com `preco_unitario < 0` levanta `23514`.
- Inserir orçamento com `desconto_valor` e `desconto_percentual` juntos levanta `23514` (só um dos dois).

- [ ] **Step 2: Rodar o teste e ver falhar**

`npx supabase test db` → espera ERROR "relation os_orcamentos does not exist".

- [ ] **Step 3: Escrever a migração**

```sql
create type public.status_orcamento as enum
  ('rascunho', 'enviado', 'aprovado', 'recusado', 'substituido');

create table public.os_orcamentos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id),
  os_id uuid not null,
  versao int not null default 1,
  status public.status_orcamento not null default 'rascunho',
  desconto_valor numeric(10,2),
  desconto_percentual numeric(5,2),
  aprovado_por text,   -- nome livre: "Ana", "cliente por WhatsApp"
  aprovado_meio text,  -- 'balcao' | 'telefone' | 'whatsapp' | 'outro'
  aprovado_em timestamptz,
  recusado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (os_id, loja_id) references public.ordens_servico(id, loja_id),
  constraint desconto_um_so check (
    desconto_valor is null or desconto_percentual is null),
  constraint desconto_positivo check (
    (desconto_valor is null or desconto_valor >= 0)
    and (desconto_percentual is null or (desconto_percentual >= 0 and desconto_percentual <= 100)))
);

create unique index os_orcamentos_vigente_un
  on public.os_orcamentos(os_id)
  where status in ('rascunho','enviado','aprovado');

create table public.os_orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.os_orcamentos(id) on delete cascade,
  loja_id uuid not null references public.lojas(id),
  descricao text not null,
  servico_id uuid,  -- opcional: ligação com catálogo de servicos
  quantidade int not null default 1 check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  ordem int not null default 0
);
```

Trigger `atualizado_em` igual ao de `ordens_servico`. RLS: `minha_loja()` + `loja_liberada()` + `not em_suporte()` em `for all to authenticated`.

- [ ] **Step 4: Rodar o teste e ver passar**

`npx supabase test db` → espera todos verdes.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261126090100_orcamentos.sql supabase/tests/orcamentos.test.sql
git commit -m "feat(orcamento): tabelas os_orcamentos e os_orcamento_itens"
```

---

## Task 2 — Peças da OS

**Files:**
- Create: `supabase/migrations/20261126090200_os_pecas.sql`
- Test: `supabase/tests/os_pecas.test.sql`

**Interfaces:**
- Consumes: `os_orcamentos` da Task 1.
- Produces: `public.os_pecas` com coluna `origem` (`estoque` | `a_comprar`), `estoque_item_id` opcional, `custo_unitario` nullable (pendente quando `origem = a_comprar`).

- [ ] **Step 1: Teste pgTAP** — assertions: RLS ligada; peça `estoque` exige `estoque_item_id`; peça `a_comprar` proíbe `estoque_item_id`; `custo_unitario` pode ser null só se `origem = a_comprar`; insert com loja_id de outra loja na FK falha.

- [ ] **Step 2: Ver falhar.** `npx supabase test db`.

- [ ] **Step 3: Migração.**

```sql
create type public.origem_peca as enum ('estoque', 'a_comprar');

create table public.os_pecas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id),
  os_id uuid not null,
  descricao text not null,
  origem public.origem_peca not null,
  estoque_item_id uuid,
  quantidade int not null default 1 check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  custo_unitario numeric(10,2) check (custo_unitario is null or custo_unitario >= 0),
  baixada_em timestamptz,   -- preenchido só na entrega
  criado_em timestamptz not null default now(),
  foreign key (os_id, loja_id) references public.ordens_servico(id, loja_id),
  constraint peca_coerente check (
    (origem = 'estoque' and estoque_item_id is not null)
    or (origem = 'a_comprar' and estoque_item_id is null)),
  constraint custo_coerente check (
    custo_unitario is not null or origem = 'a_comprar')
);
```

RLS como Task 1.

- [ ] **Step 4: Ver passar.**

- [ ] **Step 5: Commit** — `feat(pecas): tabela os_pecas com origem estoque ou a_comprar`.

---

## Task 3 — Pagamentos da OS

**Files:**
- Create: `supabase/migrations/20261126090300_os_pagamentos.sql`
- Test: `supabase/tests/os_pagamentos.test.sql`

**Interfaces:**
- Produces: `public.os_pagamentos` (uma linha por forma usada); coluna `tipo` (`sinal` | `final`).

- [ ] **Step 1: Teste pgTAP** — RLS; forma deve estar em `config_loja.formas_pagamento` (via trigger); valor > 0; parcelas só se forma é "credito".

- [ ] **Step 2: Ver falhar.**

- [ ] **Step 3: Migração.**

```sql
create type public.tipo_pagamento_os as enum ('sinal', 'final');

create table public.os_pagamentos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id),
  os_id uuid not null,
  tipo public.tipo_pagamento_os not null,
  forma text not null,        -- 'pix' | 'dinheiro' | 'debito' | 'credito'
  parcelas int,
  valor numeric(10,2) not null check (valor > 0),
  registrado_em timestamptz not null default now(),
  foreign key (os_id, loja_id) references public.ordens_servico(id, loja_id),
  constraint parcelas_so_credito check (
    (forma = 'credito' and parcelas is not null and parcelas >= 1)
    or (forma <> 'credito' and parcelas is null))
);

create function public.validar_forma_pagamento_os()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_formas text[];
begin
  select formas_pagamento into v_formas from config_loja where loja_id = new.loja_id;
  if new.forma <> all (v_formas) then
    raise exception 'Forma de pagamento não configurada para esta loja: %', new.forma
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger validar_forma before insert on public.os_pagamentos
  for each row execute function public.validar_forma_pagamento_os();
```

- [ ] **Step 4: Ver passar.**

- [ ] **Step 5: Commit** — `feat(pagamento): tabela os_pagamentos com tipo sinal/final e validação de forma`.

---

## Task 4 — Colunas de congelamento na OS

**Files:**
- Create: `supabase/migrations/20261126090600_colunas_encerramento.sql`
- Test: estender `supabase/tests/ordens_servico.test.sql` com asserts das novas colunas.

**Interfaces:**
- Produces: `ordens_servico.custo_pecas_congelado numeric(10,2)`, `comissao_congelada numeric(10,2)`, `lucro_congelado numeric(10,2)`, `tecnico_congelado_id uuid`, `comissao_percentual_congelado numeric(5,2)`. Tudo `null` até a entrega.

- [ ] **Step 1: Teste** — assert `col_exists` para cada; assert `before update` não deixa authenticated mexer nessas colunas (gatilho novo `proteger_congelados`).

- [ ] **Step 2: Ver falhar.**

- [ ] **Step 3: Migração.**

Alter table + trigger `proteger_congelados` que levanta `42501` se `current_user in ('authenticated','anon')` tenta setar qualquer uma. Só a RPC `entregar_os` (que roda `security invoker` mas chamada em contexto de sessão) consegue — vamos fazer o gatilho ignorar quando `current_setting('app.entregando_os', true) = '1'` e a RPC `set local` isso dentro da sua transação.

- [ ] **Step 4: Ver passar.**

- [ ] **Step 5: Commit** — `feat(os): colunas congeladas de custo/comissão/lucro na entrega`.

---

## Task 5 — Lógica TS do orçamento (puro)

**Files:**
- Create: `src/lib/orcamento.ts`
- Test: `tests/unit/orcamento.test.ts`

**Interfaces:**
- Produces: `calcularTotalOrcamento({ itens, pecas, descontoValor?, descontoPercentual? }): { subtotal, desconto, total }`, `calcularComissao({ total, custoPecas, percentual }): number`, `calcularLucro({ total, custoPecas, comissao }): number`.

- [ ] **Step 1: Teste Vitest** — exemplo da spec (650 cobrado, peça 280, 30%) dá base 370, comissão 111, lucro 259. Desconto em valor. Desconto em percentual. Peça a_comprar com custo null → `custoPecas` trata como 0 **e** `calcularLucro` retorna `{ lucro: null, pendencia: 'peca_sem_custo' }` para forçar a UI a avisar.

- [ ] **Step 2: Ver falhar.** `npx vitest run orcamento`.

- [ ] **Step 3: Implementar.** Três funções puras. Zero I/O.

- [ ] **Step 4: Ver passar.**

- [ ] **Step 5: Commit** — `feat(orcamento): cálculo de total, comissão e lucro em TS puro`.

---

## Task 6 — RPC aprovar/recusar/editar orçamento

**Files:**
- Create: `supabase/migrations/20261126090400_aprovar_recusar.sql`
- Test: `supabase/tests/aprovar_recusar.test.sql`

**Interfaces:**
- Produces: três funções SQL:
  - `aprovar_orcamento_os(orc uuid, de_versao int, por text, meio text) returns void` — optimistic concurrency em `versao`; muda status da OS para `aprovado` (chamando internamente `mudar_status_os`).
  - `recusar_orcamento_os(orc uuid, de_versao int) returns void` — muda status da OS para `recusado`.
  - `editar_orcamento_os(orc uuid, de_versao int) returns int` — marca versão atual como `substituido`, cria versão nova em `rascunho` com os mesmos itens, retorna nova versão. Se status atual era `aprovado`, também avança a OS de volta para `orcamento_enviado`.

- [ ] **Step 1: Teste pgTAP** — happy paths de cada RPC; concorrência: duas edições com `de_versao=1` → segunda levanta `P0001` com "A etapa mudou"; recusar orçamento já recusado é no-op silencioso ou erro? → **erro** (igual `mudar_status_os`).

- [ ] **Step 2: Ver falhar.**

- [ ] **Step 3: Migração.** As três funções, `security invoker`, `set search_path = public, pg_temp`, `for update of o` na OS, lock em `os_orcamentos`.

- [ ] **Step 4: Ver passar.**

- [ ] **Step 5: Commit** — `feat(orcamento): RPCs aprovar, recusar e editar (nova versão)`.

---

## Task 7 — RPC entregar_os (coração da Fase B)

**Files:**
- Create: `supabase/migrations/20261126090500_entregar_os.sql`
- Test: `supabase/tests/entregar_os.test.sql`

**Interfaces:**
- Produces: `entregar_os(os uuid, de_status status_os) returns void`. Dentro, em uma transação com `for update of o`:
  1. Confere status atual == `de` (optimistic).
  2. Confere que não há peça `a_comprar` com `custo_unitario is null` → se há, levanta `P0001` com "Preencha o custo de todas as peças a comprar antes de entregar.".
  3. Baixa estoque de cada peça `estoque = estoque - quantidade` e seta `baixada_em = now()` na peça.
  4. Calcula `custo_pecas = sum(custo_unitario * quantidade)` de todas as peças.
  5. Busca `% comissao` do técnico atual (`membros.comissao_percentual`).
  6. Calcula `total` da OS a partir de `os_orcamentos` aprovado + itens; `comissao = %  × (total - custo_pecas)`; `lucro = total - custo_pecas - comissao`.
  7. `set local app.entregando_os = '1'`; `update ordens_servico set status = 'entregue', encerrada_em = now(), custo_pecas_congelado = …, comissao_congelada = …, lucro_congelado = …, tecnico_congelado_id = …, comissao_percentual_congelado = …`.
  8. Insere linha em `os_historico` com `para_status = 'entregue'`.
  9. Insere linha em `comissoes_pendentes` (nova tabela — pode ficar em `20261126090700_comissoes_pendentes.sql` como Task 7.5 ou aqui mesmo).

**Simplificação para Fase B:** não cria tabela de comissões pendentes nesta fase — a comissão congelada em `ordens_servico.comissao_congelada` já serve para o relatório. Pagamento efetivo da comissão fica para Fase posterior.

- [ ] **Step 1: Teste pgTAP** — happy path; bloqueio por peça a comprar sem custo; duplo-clique: segunda chamada com `de_status=pronto` levanta "A etapa mudou"; baixa de estoque faz `estoque_itens.quantidade` diminuir; concorrência duas sessões.

- [ ] **Step 2: Ver falhar.**

- [ ] **Step 3: Migração.**

- [ ] **Step 4: Ver passar.**

- [ ] **Step 5: Commit** — `feat(os): entregar_os congela custos, comissão e baixa estoque`.

---

## Task 8 — Tela e Server Actions de orçamento

**Files:**
- Create: `src/app/(loja)/servico/[id]/_componentes/orcamento.tsx`, `src/lib/orcamento-controller.ts`
- Modify: `src/app/(loja)/servico/acoes.ts` (adicionar 3 ações), `src/app/(loja)/servico/[id]/page.tsx` (compor bloco).
- Test: `tests/unit/orcamento-controller.test.ts`, `tests/e2e/orcamento.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 5, 6. 
- Produces: `aprovarOrcamentoAcao(id, versao, form)`, `recusarOrcamentoAcao(id, versao)`, `editarOrcamentoAcao(id, versao)`. Todas chamam `exigirArea('servico')` + `membroDaSessao` antes.

- [ ] **Step 1: Ler o design system** — `C:\Users\Usuário\Desktop\Projetos\loja-saas\DESIGN.md`. Pinar classes a usar (`.sobrancelha` para "ORÇAMENTO", `.numeros` para total, `.realce` para botão principal, `.vidro` para card). 

- [ ] **Step 2: Teste Vitest do controller** — `aprovarOrcamentoComDeps` ok; erro de concorrência traduzido; peça sem custo barrada; mock do SupabaseClient.

- [ ] **Step 3: Ver falhar.**

- [ ] **Step 4: Implementar controller + action + componente.** Componente server-first; só o botão de aprovar vira client com `useFormStatus`.

- [ ] **Step 5: Teste Playwright** — abre OS, monta orçamento, aprova no balcão (nome + meio), tela mostra "Aprovado por Ana em 26/11 às 14:30 (balcão)".

- [ ] **Step 6: Ver passar.**

- [ ] **Step 7: Commit** — `feat(orcamento): tela de orçamento com aprovar, recusar e editar`.

---

## Task 9 — Tela e Server Actions de peças

**Files:**
- Create: `src/app/(loja)/servico/[id]/_componentes/pecas.tsx`, `src/lib/pecas-controller.ts`
- Modify: `src/app/(loja)/servico/acoes.ts` (`adicionarPecaAcao`, `removerPecaAcao`, `preencherCustoPecaAcao`), `src/app/(loja)/servico/[id]/page.tsx`.
- Test: `tests/unit/pecas-controller.test.ts`, `tests/e2e/pecas.spec.ts`.

**Interfaces:**
- Consumes: Task 2.
- Produces: ao escolher peça do estoque, mostra "no estoque: 3"; ao marcar "a comprar", mostra "custo pendente — Dono preenche depois"; só Dono vê e preenche `custo_unitario`.

- [ ] **Step 1: Teste controller + Zod** — escolher peça do estoque preenche custo automático; peça a comprar deixa custo null; técnico/atendente não pode mandar `custo_unitario` (middleware descarta); Dono pode.

- [ ] **Step 2: Ver falhar.**

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Playwright** — adicionar peça do estoque, adicionar peça a comprar, trocar para Dono, preencher custo, voltar para atendente, custo some do form mas aparece como leitura.

- [ ] **Step 5: Ver passar.**

- [ ] **Step 6: Commit** — `feat(pecas): tela de peças com estoque e peça a comprar`.

---

## Task 10 — Tela e Server Actions de pagamento

**Files:**
- Create: `src/app/(loja)/servico/[id]/_componentes/pagamento.tsx`, `src/lib/pagamento-controller.ts`
- Modify: `src/app/(loja)/servico/acoes.ts` (`registrarPagamentoAcao`, `removerPagamentoAcao`).
- Test: `tests/unit/pagamento-controller.test.ts`.

**Interfaces:**
- Consumes: Task 3, Task 5 (`calcularTotalOrcamento`).
- Produces: bloco mostra "Total: R$ 650 · Pago: R$ 300 · Falta: R$ 350"; soma > total barra com "O total pago não pode ultrapassar R$ 650,00."; permite tipo `sinal` só enquanto OS não está `entregue`.

- [ ] **Step 1: Teste Vitest** — soma correta, bloqueio de soma > total, parcelas só em crédito.

- [ ] **Step 2: Ver falhar.**

- [ ] **Step 3: Implementar.**

- [ ] **Step 4: Ver passar.**

- [ ] **Step 5: Commit** — `feat(pagamento): registrar sinal e pagamento parcial com várias formas`.

---

## Task 11 — Botão de entregar e bloco de lucro (só Dono)

**Files:**
- Create: `src/app/(loja)/servico/[id]/_componentes/entregar.tsx`, `src/app/(loja)/servico/[id]/_componentes/lucro.tsx`
- Modify: `src/app/(loja)/servico/acoes.ts` (`entregarOSAcao`), `src/app/(loja)/servico/[id]/page.tsx`.
- Test: `tests/e2e/entregar.spec.ts`.

**Interfaces:**
- Consumes: Task 7.
- Produces: botão "Entregar" só aparece em `pronto`; pede confirmação com saldo final; bloco "Lucro: R$ 259" só se `meuPerfil = 'dono'` e OS entregue.

- [ ] **Step 1: Playwright** — fluxo inteiro: abrir OS → montar orçamento → aprovar → adicionar peça do estoque → marcar pronto → pagar saldo → entregar → aparece lucro só para o Dono.

- [ ] **Step 2: Ver falhar.**

- [ ] **Step 3: Implementar.** `entregarOSAcao` chama RPC `entregar_os` com `de_status: 'pronto'`.

- [ ] **Step 4: Ver passar.**

- [ ] **Step 5: Commit** — `feat(os): entregar OS congela números e revela lucro para o Dono`.

---

## Task 12 — Pré-merge: checagens finais

**Files:**
- Modify: `docs/implantacao-pegadinhas.md` (adicionar as pegadinhas descobertas na Fase B).

- [ ] **Step 1:** `npx supabase test db` — espera verde total.
- [ ] **Step 2:** `npx vitest run` — espera verde total.
- [ ] **Step 3:** `npx playwright test tests/e2e/orcamento.spec.ts tests/e2e/pecas.spec.ts tests/e2e/entregar.spec.ts` — espera verde.
- [ ] **Step 4:** `npx tsc --noEmit`.
- [ ] **Step 5:** `npm run build`.
- [ ] **Step 6:** `exigirArea('servico')` presente em TODAS as novas Server Actions (grep).
- [ ] **Step 7:** Commit de documentação + abrir PR.
