# Módulo Serviço/OS — Fase A — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O lojista registra um conserto do balcão e acompanha até a entrega: cliente, aparelho, avarias, técnico, laudo e fluxo de status com histórico.

**Architecture:** Mesmo desenho da fundação. O banco é a fronteira de segurança (RLS por loja com `minha_loja()`/`meu_perfil()`/`loja_liberada()`), as regras puras ficam em `src/lib/` testadas com Vitest, as Server Actions são cascas finas sobre funções com dependências injetadas, e as telas usam só os componentes de `src/components/ui/`. A senha do aparelho vive em tabela própria cifrada e é apagada quando a OS encerra.

**Tech Stack:** Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind 4, Supabase (Postgres + RLS + pgcrypto + Vault), Zod, Vitest, pgTAP, Playwright.

**Spec:** `C:\Users\Usuário\Desktop\Projetos\master-iphone\docs\superpowers\specs\2026-11-22-sistema-completo-design.md` — seções 8.1, 8.2, 8.3 e as decisões em 13.1.

**Design:** `DESIGN.md` na raiz deste repositório. É normativo: ler antes de escrever qualquer tela.

## Escopo

**Dentro:** clientes (cadastro, busca, histórico); OS (numeração por loja, aparelho, senha do aparelho, defeito, acessórios, checklist de avarias, técnico responsável, laudo, previsão de entrega, OS interna); fluxo de status com histórico e regra de voltar etapa.

**Fora (fases seguintes):** orçamento, peças, pagamento, comissão, lucro, link público de acompanhamento, WhatsApp, garantia, documentos impressos, fotos, assinatura.

**Fora de propósito:** a importação de clientes por planilha do §8.1 **não** entra. O §13.1 decide que a primeira loja "começa do zero e cadastra conforme usa" — construir importação agora seria código sem usuário.

## Global Constraints

- **Isolamento por loja é inegociável.** Toda tabela nova leva `loja_id` e RLS com `loja_id = public.minha_loja() and public.loja_liberada(loja_id)`. Nenhuma consulta do app filtra loja na mão — quem filtra é a RLS.
- **Escrita exige `not public.em_suporte()`.** O admin em modo suporte lê, nunca escreve (§13.1, LGPD).
- **Custo nunca aparece para técnico nem atendente.** Nesta fase não há custo na OS; a regra vale para o que vier.
- **Senha do aparelho é dado sensível:** tabela própria, cifrada, lida só por função com checagem de perfil, apagada ao encerrar a OS (§8.3).
- **CPF é dado sensível:** nunca em log, nunca em URL, nunca em tela pública.
- **Vocabulário do balcão** nos textos de tela: "aparelho", "conserto", "cliente", "Dono" — nunca "registro" ou "entidade".
- **Nenhuma cor crua.** Só tokens do `DESIGN.md`; `text-white` e `bg-black` contam como cor crua.
- **Toda ação que espera o servidor mostra carregando** (`<Botao carregando>` ou `<BotaoEnviar>`), conforme `DESIGN.md` §6.1.
- **Campo obrigatório pela regra da exceção** (`DESIGN.md` §6.2): formulário todo obrigatório leva `<TodosObrigatorios />`.
- **Alvo de toque mínimo 44px** (`min-h-11`), telas conferidas a ~400px de largura e nos dois temas.
- Migrações nomeadas `supabase/migrations/20261125<HHMMSS>_<nome>.sql`, aplicadas em ordem.

## Decisões tomadas neste plano *(o spec deixou ao construtor)*

1. **Peças fora do estoque.** O módulo Estoque ainda não existe; o §13.1 já decide que "Serviço funciona com ou sem Estoque". Peças são Fase B — mas as tabelas desta fase não assumem estoque.
2. **Senha do aparelho:** tabela `os_senha_aparelho`, valor cifrado com `pgp_sym_encrypt` (pgcrypto) e chave guardada no Supabase Vault; leitura só pela função `public.senha_aparelho(os uuid)` (security definer) que exige mesma loja, perfil `dono` ou `tecnico` e OS não encerrada. Trigger apaga a linha ao encerrar.
3. **Checklist é fotografia, não referência.** A OS guarda o **nome** do item de checklist no momento da abertura. Se a loja editar `checklist_itens` depois, a OS continua mostrando o que foi registrado.
4. **Estados terminais não voltam.** "Voltar etapa só o Dono" (§8.3) vale entre estados não-terminais. `entregue` e `devolvido` encerram a OS e não são revertidos por ninguém — reabrir vira OS nova (OS de garantia é Fase C).
5. **Numeração por loja** começa em `config_loja.os_numero_inicial` e é atribuída por trigger com trava na linha da loja, para dois atendimentos simultâneos não gerarem o mesmo número.

## Review Focus

Entradas e falhas que o spec implica e que mordem o usuário se ninguém testar. Cada uma tem teste na tarefa dona.

1. **Duas OS abertas ao mesmo tempo na mesma loja** devem receber números diferentes — a numeração não pode depender de `max()` sem trava (Tarefa 2).
2. **Loja edita o checklist de avarias depois da OS aberta** — a OS já registrada não pode mudar nem perder itens (Tarefa 3).
3. **Técnico de outra loja** não lê, não altera e não descobre a senha do aparelho de uma OS que não é da sua loja (Tarefas 1, 2, 4).
4. **Transição de status inválida chegando direto na Server Action** (sem passar pela tela) deve ser recusada, e voltar etapa por quem não é Dono também (Tarefas 5, 9).
5. **OS encerrada** não guarda mais a senha do aparelho, e OS interna não aceita cliente enquanto OS normal exige cliente (Tarefas 4, 6).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/…_clientes.sql` | tabela `clientes` + RLS |
| `supabase/migrations/…_ordens_servico.sql` | enums, `ordens_servico`, numeração, RLS |
| `supabase/migrations/…_os_checklist_historico.sql` | `os_checklist`, `os_historico` + RLS |
| `supabase/migrations/…_os_senha_aparelho.sql` | tabela cifrada, função de leitura, apagar ao encerrar |
| `src/lib/os-status.ts` | máquina de status (puro) |
| `src/lib/validacoes.ts` | esquemas Zod de cliente e OS (acrescenta ao existente) |
| `src/lib/clientes.ts` | regras das ações de cliente, dependências injetadas |
| `src/lib/os.ts` | regras das ações de OS, dependências injetadas |
| `src/app/(loja)/clientes/` | `page.tsx`, `acoes.ts`, `dados.ts`, `_componentes/` |
| `src/app/(loja)/servico/` | `page.tsx`, `nova/page.tsx`, `[id]/page.tsx`, `acoes.ts`, `dados.ts`, `_componentes/` |

---

### Task 1: Banco — clientes

**Files:**
- Create: `supabase/migrations/20261125090000_clientes.sql`
- Test: `supabase/tests/clientes.test.sql`

**Interfaces:**
- Produces: tabela `public.clientes (id uuid pk, loja_id uuid, nome text, telefone text, cpf text, email text, endereco text, nascimento date, criado_em timestamptz)`, com `unique (id, loja_id)` para chaves compostas futuras.

- [ ] **Step 1: Escrever o teste pgTAP que falha**

Em `supabase/tests/clientes.test.sql`, no estilo de `supabase/tests/nucleo_isolamento.test.sql`:
- `clientes` tem RLS habilitada.
- Membro da loja A insere e lê o próprio cliente.
- Membro da loja B **não** enxerga o cliente da loja A (`is_empty`).
- Membro da loja B **não** consegue atualizar nem apagar o cliente da loja A.
- Loja suspensa: membro não lê nem escreve (`loja_liberada`).
- Admin em suporte lê, mas o insert falha.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx supabase test db`
Expected: FAIL — relação `clientes` não existe.

- [ ] **Step 3: Escrever a migração**

Tabela conforme Interfaces. `nome` e `telefone` são `not null` (§8.1); `cpf`, `email`, `endereco`, `nascimento` são nulos. Índices: `(loja_id, nome)`, `(loja_id, telefone)`, `(loja_id, cpf)`. RLS no padrão de `supabase/migrations/20261122000003_configuracoes.sql`: leitura para membro da loja liberada; escrita para membro da loja liberada com `not public.em_suporte()`. Clientes são do atendimento — leitura e escrita para os três perfis.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests
git commit -m "feat(clientes): tabela e RLS por loja"
```

---

### Task 2: Banco — ordens de serviço e numeração

**Files:**
- Create: `supabase/migrations/20261125090100_ordens_servico.sql`
- Test: `supabase/tests/ordens_servico.test.sql`

**Interfaces:**
- Consumes: `public.clientes` (Tarefa 1), `public.membros`, `public.config_loja.os_numero_inicial`.
- Produces: enums `public.tipo_aparelho ('celular','tablet','relogio','notebook','outro')` e `public.status_os ('aberta','em_analise','orcamento_enviado','aprovado','recusado','aguardando_peca','em_servico','pronto','pronto_devolucao','entregue','devolvido')`; tabela `public.ordens_servico` com `unique (loja_id, numero)` e `unique (id, loja_id)`.

- [ ] **Step 1: Escrever o teste pgTAP que falha**

- A primeira OS da loja recebe o número de `config_loja.os_numero_inicial`; a segunda recebe o seguinte.
- Duas lojas numeram **independentemente** (as duas começam no seu próprio inicial).
- **Concorrência:** dentro de uma transação, inserir duas OS na mesma loja gera números distintos; `unique (loja_id, numero)` existe (`has_unique_index`/`col_is_unique`).
- Isolamento: membro da loja B não lê nem altera OS da loja A.
- `interna = true` exige `cliente_id is null`; `interna = false` exige `cliente_id not null` (`throws_ok` nos dois sentidos).
- Status inicial é `aberta`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx supabase test db`
Expected: FAIL — relação `ordens_servico` não existe.

- [ ] **Step 3: Escrever a migração**

Colunas: `id`, `loja_id`, `numero int not null`, `cliente_id uuid null` (FK composta `(cliente_id, loja_id) → clientes (id, loja_id)`), `interna boolean not null default false`, `aparelho_tipo public.tipo_aparelho not null`, `marca text`, `modelo text`, `cor text`, `imei text`, `defeito_relatado text not null`, `acessorios text[] not null default '{}'`, `observacao text`, `tecnico_id uuid null` (FK composta para `membros (id, loja_id)`), `laudo text`, `previsao_entrega date`, `status public.status_os not null default 'aberta'`, `encerrada_em timestamptz`, `criado_em`, `atualizado_em`.

Restrição `os_cliente_coerente`: `(interna and cliente_id is null) or (not interna and cliente_id is not null)`.

Numeração: trigger `before insert` que trava a linha da loja (`perform 1 from lojas where id = new.loja_id for update`) e calcula
`new.numero := greatest(coalesce(max(numero)+1 ...), (select os_numero_inicial from config_loja ...))`.
A trava na linha da loja é o que impede número duplicado em inserções simultâneas — é o mesmo padrão de `verificar_limite_usuarios`.

Índices: `(loja_id, status)`, `(loja_id, criado_em desc)`, `(loja_id, imei)`. RLS: leitura e escrita para membro da loja liberada, escrita com `not public.em_suporte()`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests
git commit -m "feat(os): tabela de ordens de serviço com numeração por loja"
```

---

### Task 3: Banco — checklist da OS e histórico de status

**Files:**
- Create: `supabase/migrations/20261125090200_os_checklist_historico.sql`
- Test: `supabase/tests/os_checklist_historico.test.sql`

**Interfaces:**
- Consumes: `public.ordens_servico` (Tarefa 2), `public.checklist_itens`.
- Produces: `public.os_checklist (id, os_id, loja_id, nome text, marcado boolean, observacao text)` e `public.os_historico (id, os_id, loja_id, de_status, para_status, membro_id, observacao, criado_em)`.

- [ ] **Step 1: Escrever o teste pgTAP que falha**

- `os_checklist.nome` guarda o texto no momento do registro: apagar o `checklist_itens` de origem **não** apaga nem altera a linha da OS (é o Review Focus 2).
- As duas tabelas têm RLS e seguem o isolamento por loja.
- `os_historico` é **somente inserção e leitura**: update e delete são recusados para qualquer perfil (`throws_ok`).
- Apagar a OS leva junto checklist e histórico (`on delete cascade`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx supabase test db`
Expected: FAIL — relação `os_checklist` não existe.

- [ ] **Step 3: Escrever a migração**

As duas tabelas com FK composta `(os_id, loja_id) → ordens_servico (id, loja_id) on delete cascade`. `os_checklist.nome` é `text not null` (cópia, não FK). `os_historico` sem política de update/delete — a ausência de política já recusa; o teste prova.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests
git commit -m "feat(os): checklist registrado e histórico de status"
```

---

### Task 4: Banco — senha do aparelho, cifrada e efêmera

**Files:**
- Create: `supabase/migrations/20261125090300_os_senha_aparelho.sql`
- Test: `supabase/tests/os_senha_aparelho.test.sql`

**Interfaces:**
- Produces: `public.os_senha_aparelho (os_id uuid pk, loja_id uuid, senha_cifrada bytea, criado_em)`; funções `public.guardar_senha_aparelho(os uuid, senha text) returns void` e `public.senha_aparelho(os uuid) returns text`.

- [ ] **Step 1: Escrever o teste pgTAP que falha**

- Guardar e ler devolve a senha original para `dono` e para `tecnico` da mesma loja.
- `atendente` recebe `null` (não é dele).
- Membro de outra loja recebe `null`.
- A coluna guardada **não** contém o texto puro (`senha_cifrada::text` não casa com a senha).
- Ao mudar a OS para `entregue` (ou `devolvido`), a linha some (`is_empty`) — §8.3.
- Admin em suporte não lê a senha (`null`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx supabase test db`
Expected: FAIL — função `guardar_senha_aparelho` não existe.

- [ ] **Step 3: Escrever a migração**

`create extension if not exists pgcrypto`. A chave vem de um segredo do Vault (`vault.decrypted_secrets` com nome `senha_aparelho_chave`); uma função `security definer` interna devolve a chave e **nunca** é exposta ao papel `authenticated`. `guardar_senha_aparelho` usa `pgp_sym_encrypt`; `senha_aparelho` usa `pgp_sym_decrypt` e só devolve valor quando: mesma loja (`loja_id = public.minha_loja()`), `public.meu_perfil() in ('dono','tecnico')`, `not public.em_suporte()` e a OS não está encerrada. Fora disso devolve `null` — nunca levanta erro, para não virar oráculo de existência.

Trigger `after update of status on ordens_servico`: quando o novo status é `entregue` ou `devolvido`, apaga a linha da senha e grava `encerrada_em = now()`.

A tabela não recebe política alguma para `authenticated`: o acesso é só pelas duas funções.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx supabase test db`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests
git commit -m "feat(os): senha do aparelho cifrada e apagada no encerramento"
```

---

### Task 5: Regras puras — máquina de status

**Files:**
- Create: `src/lib/os-status.ts`
- Test: `tests/unit/os-status.test.ts`

**Interfaces:**
- Produces:
  - `export type StatusOS` (os 11 valores do enum da Tarefa 2)
  - `export const ROTULO_STATUS: Record<StatusOS, { rotulo: string; tom: TomSelo }>`
  - `export function ehTerminal(s: StatusOS): boolean`
  - `export function avancosDe(s: StatusOS): StatusOS[]`
  - `export function podeMudar(de: StatusOS, para: StatusOS, perfil: Perfil): { ok: true } | { ok: false; erro: string }`

- [ ] **Step 1: Escrever o teste que falha**

```ts
test('avança pelo caminho normal', () => {
  expect(podeMudar('aberta', 'em_analise', 'atendente')).toEqual({ ok: true })
  expect(podeMudar('em_servico', 'pronto', 'tecnico')).toEqual({ ok: true })
})

test('atalho do balcão: aberta direto para aprovado', () => {
  expect(podeMudar('aberta', 'aprovado', 'atendente')).toEqual({ ok: true })
})

test('pulo inválido é recusado', () => {
  expect(podeMudar('aberta', 'entregue', 'dono').ok).toBe(false)
})

test('voltar etapa é só do Dono', () => {
  expect(podeMudar('em_servico', 'aprovado', 'dono')).toEqual({ ok: true })
  expect(podeMudar('em_servico', 'aprovado', 'tecnico')).toEqual({
    ok: false,
    erro: 'Só o Dono pode voltar uma etapa',
  })
})

test('OS encerrada não volta, nem para o Dono', () => {
  expect(ehTerminal('entregue')).toBe(true)
  expect(podeMudar('entregue', 'pronto', 'dono')).toEqual({
    ok: false,
    erro: 'A OS já foi encerrada',
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/os-status.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `src/lib/os-status.ts`**

Avanços permitidos, do §8.3:

```
aberta           → em_analise, aprovado
em_analise       → orcamento_enviado, aprovado
orcamento_enviado→ aprovado, recusado
aprovado         → aguardando_peca, em_servico
aguardando_peca  → em_servico
em_servico       → pronto
pronto           → entregue
recusado         → pronto_devolucao
pronto_devolucao → devolvido
entregue, devolvido → (terminais)
```

`podeMudar` decide nesta ordem: terminal de origem → "A OS já foi encerrada"; destino em `avancosDe(de)` → ok; destino alcançável para trás e perfil `dono` → ok; perfil diferente de `dono` num retorno → "Só o Dono pode voltar uma etapa"; resto → "Essa mudança de etapa não é permitida". `ROTULO_STATUS` usa os tons do `Selo` (`DESIGN.md` §5).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/os-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/os-status.ts tests/unit/os-status.test.ts
git commit -m "feat(os): máquina de status com regra de voltar etapa"
```

---

### Task 6: Validação — esquemas de cliente e de OS

**Files:**
- Modify: `src/lib/validacoes.ts`
- Test: `tests/unit/validacoes.test.ts` (acrescenta)

**Interfaces:**
- Produces: `esquemaCliente`, `esquemaNovaOS`, `esquemaLaudo` e `export function cpfValido(cpf: string): boolean`.

- [ ] **Step 1: Escrever o teste que falha**

```ts
test('cliente exige nome e telefone', () => {
  expect(esquemaCliente.safeParse({ nome: '', telefone: '13999999999' }).success).toBe(false)
  expect(esquemaCliente.safeParse({ nome: 'Ana', telefone: '' }).success).toBe(false)
})

test('CPF é opcional, mas inválido é recusado', () => {
  expect(esquemaCliente.safeParse({ nome: 'Ana', telefone: '13999999999' }).success).toBe(true)
  const r = esquemaCliente.safeParse({ nome: 'Ana', telefone: '13999999999', cpf: '111.111.111-11' })
  expect(r.success).toBe(false)
})

test('OS normal exige cliente; OS interna recusa cliente', () => {
  const base = { aparelhoTipo: 'celular', defeitoRelatado: 'Tela trincada' }
  expect(esquemaNovaOS.safeParse({ ...base, interna: false }).success).toBe(false)
  expect(esquemaNovaOS.safeParse({ ...base, interna: true, clienteId: 'x' }).success).toBe(false)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/validacoes.test.ts`
Expected: FAIL — `esquemaCliente` não existe.

- [ ] **Step 3: Implementar os esquemas**

`cpfValido` confere os dois dígitos verificadores e recusa sequências repetidas (`111...`). `esquemaCliente`: `nome` e `telefone` obrigatórios; `cpf`, `email`, `endereco`, `nascimento` opcionais, com `cpf` passando por `cpfValido` quando presente. `esquemaNovaOS`: `aparelhoTipo` do enum, `defeitoRelatado` obrigatório, `interna` booleano, `clienteId` condicional por `refine` (mensagem "Escolha o cliente" / "OS interna não tem cliente"), `acessorios` array de texto, `checklist` array de `{ nome, marcado, observacao? }`, `previsaoEntrega` data opcional, `senhaAparelho` texto opcional. Reaproveitar os auxiliares já existentes no arquivo.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/validacoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validacoes.ts tests/unit/validacoes.test.ts
git commit -m "feat(os): validação de cliente e de abertura de OS"
```

---

### Task 7: Ações de clientes

**Files:**
- Create: `src/lib/clientes.ts`, `src/app/(loja)/clientes/acoes.ts`, `src/app/(loja)/clientes/dados.ts`
- Test: `tests/unit/clientes-acoes.test.ts`

**Interfaces:**
- Consumes: `esquemaCliente` (Tarefa 6).
- Produces, no padrão de `src/lib/configuracoes.ts` (`Dependencias` injetadas, `Resultado`):
  - `salvarClienteCom(deps, dados, id?): Promise<Resultado>`
  - `buscarClientesCom(deps, termo: string): Promise<Cliente[]>`
  - `export type Cliente = { id, nome, telefone, cpf, email, endereco, nascimento }`
  - Em `dados.ts`: `carregarCliente(id)`, `carregarHistoricoDoCliente(id)`.

- [ ] **Step 1: Escrever o teste que falha**

Com dependências falsas (sem rede), no estilo de `tests/unit/config-acoes.test.ts`:
- dados inválidos param antes de tocar o banco (o falso não é chamado);
- a busca por termo vazio devolve os mais recentes, sem explodir;
- a busca escapa `%` e `_` para não virar curinga (`'100%'` procura o literal);
- erro do banco vira a mensagem genérica, nunca o texto cru do Postgres.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/clientes-acoes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`buscarClientesCom` procura em nome, telefone, CPF e **IMEI de OS do cliente** (§8.1) — o IMEI exige juntar `ordens_servico`. Ordem: validar → gravar com o cliente da sessão (a RLS confere) → mapear erro com `erroDoBanco`. `acoes.ts` é casca fina `'use server'` que monta as dependências, como `configuracoes/acoes.ts`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/clientes-acoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientes.ts "src/app/(loja)/clientes" tests/unit/clientes-acoes.test.ts
git commit -m "feat(clientes): ações de cadastro e busca"
```

---

### Task 8: Telas de clientes

**Files:**
- Create: `src/app/(loja)/clientes/page.tsx` (substitui o `EmBreve`), `src/app/(loja)/clientes/_componentes/lista.tsx`, `_componentes/formulario.tsx`, `src/app/(loja)/clientes/[id]/page.tsx`

**Interfaces:**
- Consumes: Tarefa 7.

- [ ] **Step 1: Escrever as telas**

Seguir `DESIGN.md`: busca no topo, `TabelaResponsiva` com colunas Nome / Telefone / Cidade; vazio com texto que diz o que fazer. O formulário usa `Campo`, marca os opcionais com `opcional` (nome e telefone são os únicos obrigatórios → regra da exceção, §6.2) e envia com `<Botao carregando={pendente}>`. A ficha do cliente mostra os dados e o histórico de OS com `Selo` de status.

- [ ] **Step 2: Conferir build e tipos**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 3: Conferir na tela**

Subir `npm run dev -- --port 3100`, entrar com o seed local, abrir `/clientes`: cadastrar, buscar e abrir a ficha. Conferir a ~400px de largura e nos dois temas (`DESIGN.md` §9).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(loja)/clientes"
git commit -m "feat(clientes): telas de lista, cadastro e ficha"
```

---

### Task 9: Ações de OS

**Files:**
- Create: `src/lib/os.ts`, `src/app/(loja)/servico/acoes.ts`, `src/app/(loja)/servico/dados.ts`
- Test: `tests/unit/os-acoes.test.ts`

**Interfaces:**
- Consumes: `esquemaNovaOS` (Tarefa 6), `podeMudar` (Tarefa 5), `guardar_senha_aparelho` (Tarefa 4).
- Produces:
  - `abrirOSCom(deps, dados): Promise<{ ok: true; id: string; numero: number } | { ok: false; erro: string }>`
  - `mudarStatusCom(deps, osId, para: StatusOS, observacao?): Promise<Resultado>`
  - `salvarLaudoCom(deps, osId, laudo: string): Promise<Resultado>`

- [ ] **Step 1: Escrever o teste que falha**

- abrir OS grava o checklist como cópia (nomes vindos de `checklist_itens`) e chama `guardar_senha_aparelho` só quando veio senha;
- `mudarStatusCom` recusa transição inválida **antes** de tocar o banco, com a mensagem de `podeMudar` (Review Focus 4);
- `mudarStatusCom` grava uma linha em `os_historico` com `de_status`, `para_status` e o membro;
- técnico tentando voltar etapa é recusado;
- erro do banco vira mensagem genérica.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/os-acoes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Ordem de sempre: validar → conferir perfil/transição sem rede → gravar. A mudança de status e a linha de histórico vão juntas; se o histórico falhar, a ação responde erro (a tela não pode dizer que mudou sem registro). `dados.ts` carrega a lista com filtro por status e a OS completa, buscando a senha pela função `senha_aparelho` só quando o perfil permite.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/os-acoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/os.ts "src/app/(loja)/servico" tests/unit/os-acoes.test.ts
git commit -m "feat(os): ações de abrir OS, mudar status e salvar laudo"
```

---

### Task 10: Telas de OS

**Files:**
- Create: `src/app/(loja)/servico/page.tsx` (substitui o `EmBreve`), `servico/nova/page.tsx`, `servico/[id]/page.tsx`, `servico/_componentes/` (`lista.tsx`, `formulario.tsx`, `status.tsx`, `senha.tsx`)

**Interfaces:**
- Consumes: Tarefas 5, 7, 9.

- [ ] **Step 1: Escrever as telas**

Lista: filtro por status com os chips do `Selo`, `TabelaResponsiva` com Nº (`.numeros`), Cliente, Aparelho, Status e Previsão. Abertura: cliente (busca ou OS interna), aparelho, defeito, acessórios, checklist da loja com observação por item, técnico, previsão, senha do aparelho. Detalhe: cabeçalho com nº e `Selo`, botões das transições permitidas (`avancosDe`), histórico em linha do tempo, laudo editável. A senha do aparelho fica **escondida atrás de um botão "Mostrar senha"** e não aparece em lista nem em impressão.

- [ ] **Step 2: Conferir build e tipos**

Run: `npx tsc --noEmit && npm run build`
Expected: sem erros.

- [ ] **Step 3: Conferir na tela**

Abrir uma OS ponta a ponta no navegador, avançar status, salvar laudo. Conferir a ~400px e nos dois temas.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(loja)/servico"
git commit -m "feat(os): telas de lista, abertura e detalhe da OS"
```

---

### Task 11: e2e da Fase A

**Files:**
- Create: `tests/e2e/servico.spec.ts`

**Interfaces:**
- Consumes: tudo acima; semeia pela service role como `tests/e2e/global-setup.ts`.

- [ ] **Step 1: Escrever o teste que falha**

Um percurso só, como o da fundação: Dono entra → cadastra cliente → abre OS com checklist e senha → vê a OS na lista → avança até `entregue` → confirma que o histórico tem as etapas e que a senha não aparece mais. Depois, um **técnico** tenta voltar etapa e recebe a recusa.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:e2e`
Expected: FAIL.

- [ ] **Step 3: Ajustar o que o percurso revelar**

Corrigir a aplicação (não o teste) quando a falha for real.

- [ ] **Step 4: Rodar a bateria toda**

Run: `npm test && npx supabase test db && npm run test:e2e && npm run build`
Expected: tudo passa.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/servico.spec.ts
git commit -m "test(os): percurso ponta a ponta da Fase A"
```

---

## Fases seguintes (um plano por fase, escrito quando começar)

- **Fase B** — orçamento (versões, aprovar/recusar), peças à mão, pagamento e sinal, comissão e lucro.
- **Fase C** — link público de acompanhamento, WhatsApp (`wa.me` + mensagens padrão), garantia e OS de garantia.
- **Fase D** — documentos (A4, cupom 80mm, etiqueta, termo), fotos de entrada/saída, assinatura do cliente.
