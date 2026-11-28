# Plano 4 — Fase C do módulo Serviço/OS: link de acompanhamento, WhatsApp e garantia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cliente da loja acompanha o conserto por um link público e aprova ou recusa o orçamento pelo celular; a loja avisa o cliente pelo próprio WhatsApp com um toque; a garantia do serviço tem prazo, termo impresso, consulta e OS de garantia sem cobrança.

**Architecture:** O link público nunca lê tabela: a página `/acompanhar/[token]` chama funções `security definer` do banco, que recebem o token, devolvem só os campos permitidos e gravam a resposta do cliente. `anon` não tem política em tabela nenhuma. WhatsApp é só um link `wa.me` montado em TS puro (sem API, sem envio automático, sem risco ao número). A garantia é congelada na entrega pela `entregar_os`, como os outros números.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase (Postgres + RLS + pgTAP), Zod, Vitest, Playwright, Tailwind 4.

**Spec:** `C:\Users\Usuário\Desktop\Projetos\master-iphone\docs\superpowers\specs\2026-11-22-sistema-completo-design.md` — seções 8.3 ("Avisar cliente"), 8.4 (aprovação pelo link), 8.7 e 8.8.

## Global Constraints

- **O link público nunca mostra** CPF, senha do aparelho, custo, comissão, lucro, observação interna, nome de membro além do primeiro nome, nem dados de outra OS. Mostra: loja (nome, logo, telefone, endereço), nº da OS, aparelho, status com histórico (datas e etapas), orçamento atual (itens, peças pelo preço, desconto, total) com Aprovar/Recusar quando enviado, pagamento (total, pago, falta) e, depois de entregue, a garantia (prazo, vencimento, condições).
- **Token:** 24 bytes aleatórios em hex (48 caracteres), gerado no banco ao abrir a OS, único. Token errado e OS de loja suspensa dão a mesma resposta ("Link não encontrado"), sem distinguir.
- **Aprovação pelo link** grava `aprovado_meio = 'link'` e `aprovado_por` = nome que o cliente digitar (obrigatório, até 80). Só vale para orçamento **enviado** (rascunho não aparece para aprovar). Mesmo efeito na OS que a aprovação do balcão (`mudar_status_os` para `aprovado`, histórico "pelo link").
- **WhatsApp:** `https://wa.me/55<DDD+número>?text=<mensagem codificada>`; telefone só com dígitos; com 10 ou 11 dígitos ganha o `55`; com 12–13 começando em `55` fica como está; fora disso, o botão não aparece ("telefone do cliente incompleto"). A mensagem vem de `mensagens_padrao` da loja, com as variáveis da spec preenchidas; variável sem valor vira texto vazio, nunca `{variavel}` cru.
- **Garantia:** prazo = ajuste na OS (só o Dono, antes da entrega) → senão o maior `garantia_dias` dos serviços do catálogo no orçamento aprovado → senão `config_loja.garantia_servico_dias`. Conta da **entrega**. Congelado na entrega em `ordens_servico.garantia_dias`; vence em `encerrada_em::date + garantia_dias`.
- **OS de garantia:** só a partir de OS **entregue** e **dentro** do prazo; liga-se à original (`garantia_de`); não exige orçamento nem pagamento; comissão 0; total 0; custo das peças vai para o fechamento dela (o relatório soma na original depois, no Financeiro).
- RLS por loja em tudo; funções `security definer` conferem a loja à mão; `revoke all ... from public, anon` e grant explícito.
- Design system `DESIGN.md` obrigatório. A página pública é white-label: nome e logo **da loja**, nunca "Gestow".

## Review Focus

- **Token adivinhável ou vazado por log:** token só no caminho da URL, nunca em query string; função recusa token com formato errado sem consultar.
- **Cliente aprova orçamento que o atendente já trocou:** aprovar pelo link confere que o orçamento atual ainda é o enviado que a página mostrou (passa o `orcamento_id`); se mudou, "O orçamento foi atualizado. Recarregue a página."
- **Duplo toque em Aprovar no celular:** segunda chamada recebe "Este orçamento já foi respondido.".
- **Loja suspensa:** o link para de responder.
- **OS de garantia de OS fora do prazo ou não entregue:** recusada com mensagem clara.

---

## Task 1 — Link público no banco

**Files:** `supabase/migrations/20261128090100_link_acompanhamento.sql`, `supabase/tests/link_acompanhamento.test.sql`

**Produces:**
- `ordens_servico.token_publico text not null unique default encode(gen_random_bytes(24), 'hex')` (OS antigas ganham token na migração).
- `os_orcamentos.aprovado_meio` aceita também `'link'`.
- `acompanhamento_os(token text) returns jsonb` — `security definer`, executável por `anon` e `authenticated`; `null` se token inválido/inexistente/loja não liberada. JSON com: `loja {nome, telefone, endereco, logo_path}`, `os {numero, aparelho, status, criado_em, encerrada_em, previsao_entrega}`, `historico [{para_status, criado_em}]`, `orcamento {id, versao, status, itens[{descricao, quantidade, preco_unitario}], desconto_valor, desconto_percentual} | null`, `pecas [{descricao, quantidade, preco_unitario}]`, `pagamento {pago}`, `garantia {dias, vence_em, condicoes[]} | null`.
- `responder_orcamento_pelo_link(token text, orc uuid, aprova boolean, nome text) returns void` — `security definer`, `anon`; confere token, que `orc` é o atual e está `enviado`; aprova (meio `link`) ou recusa, mudando a OS pela mesma regra das funções do Plano 3.

- [ ] Teste pgTAP: token tem 48 hex e é único; `anon` não lê `ordens_servico` direto; JSON não contém `cpf`, `senha`, `custo`, `lucro`, `observacao`; token errado → null; loja suspensa → null; aprovar pelo link (meio `link`, OS → aprovado, histórico); duplo toque; orçamento trocado; recusar; rascunho não aprova.
- [ ] Migração, ver passar, commit `feat(link): acompanhamento público da OS no banco`.

## Task 2 — Página pública `/acompanhar/[token]`

**Files:** `src/app/acompanhar/[token]/page.tsx`, `src/app/acompanhar/[token]/resposta.tsx`, `src/app/acompanhar/acoes.ts`, `src/lib/acompanhamento.ts`, `tests/unit/acompanhamento.test.ts`

- Leitura pelo cliente **anônimo** do Supabase (chave pública) chamando `acompanhamento_os`. Logo assinada com a service role (bucket `logos` é privado), 1 h.
- Layout próprio, sem trilho do app: cabeçalho com logo e nome da loja; selo da etapa; linha do tempo; orçamento com total; bloco "Aprovar orçamento" (nome + Aprovar/Recusar com confirmação) só quando enviado; pagamento; garantia quando entregue; contato da loja (telefone selecionável).
- Token fora do formato → 404 sem chamar o banco. Funciona sem login e com o celular.
- [ ] Testes Vitest das regras (montagem dos dados, formato do token, tradução de erro); navegador (celular, tema escuro); commit.

## Task 3 — WhatsApp "Avisar cliente"

**Files:** `src/lib/whatsapp.ts`, `tests/unit/whatsapp.test.ts`, `src/app/(loja)/servico/_componentes/avisar.tsx`, página da OS.

- `numeroWhatsApp(telefone): string | null`, `preencherMensagem(texto, valores): string`, `linkWhatsApp(telefone, texto): string | null`.
- Na OS de cliente: cartão "Avisar cliente" com o evento que combina com a etapa (aberta → `os_aberta`, orçamento enviado → `orcamento_enviado`, aguardando peça, pronto, entregue, devolvido), mensagem pronta e editável, e botão "Abrir no WhatsApp" (link `wa.me`, abre em nova aba). Link de acompanhamento sempre disponível com "Copiar link".
- [ ] Testes Vitest (telefone, variáveis, codificação); navegador; commit.

## Task 4 — Garantia no banco e OS de garantia

**Files:** `supabase/migrations/20261128090200_garantia.sql`, `supabase/tests/garantia.test.sql`

- `ordens_servico.garantia_ajuste_dias int` (só Dono grava, só antes da entrega), `ordens_servico.garantia_dias int` (só a entrega grava), `ordens_servico.garantia_de uuid` (FK composta para a OS original da mesma loja).
- `entregar_os` passa a: calcular e gravar `garantia_dias`; numa OS de garantia, dispensar orçamento e pagamento, total 0 e comissão 0.
- `abrir_os_garantia(os uuid, defeito text) returns uuid` — da OS entregue e dentro do prazo, cria a nova (mesmo cliente e aparelho, `garantia_de`), devolve o id.
- [ ] Testes pgTAP das três fontes de prazo, só Dono ajusta, OS de garantia (fora do prazo recusa, entrega sem pagamento, comissão 0); commit.

## Task 5 — Garantia na tela

**Files:** `src/lib/garantia.ts` (+ teste), página da OS, `src/app/(loja)/servico/[id]/termo/page.tsx`.

- Bloco "Garantia": antes da entrega mostra o prazo previsto e (Dono) o ajuste; depois, prazo, vencimento e situação (vigente / vence em N dias / vencida), botão "Termo de garantia" e "Abrir OS de garantia".
- Termo A4 imprimível (`@media print`): loja, cliente, aparelho, IMEI, serviços, data da entrega, prazo, vencimento, condições, texto de termos da loja.
- OS de garantia mostra "Garantia da OS nº X" com link.
- [ ] Testes; navegador; commit.

## Task 6 — Consulta de garantias

**Files:** `src/app/(loja)/servico/garantias/page.tsx`, `src/lib/garantia.ts`.

- Lista de OS entregues com garantia vigente, mais próximas de vencer primeiro; filtro "vence em até 15 dias"; busca por nome, telefone ou IMEI (pela Server Action, fora da URL, como em Clientes). Link no topo da lista de Serviço.
- [ ] Testes; navegador; commit.

## Situação (28/11)

Tasks 1 a 6 feitas. Decisões tomadas na execução: OS de garantia não abre garantia nova (vale a da original) e OS interna não tem garantia; WhatsApp só por `wa.me`, sem envio automático; a busca de garantias filtra na tela (o termo não vai para a URL); tokens `folha*` para documento impresso; a página da OS não cai sem `NEXT_PUBLIC_SITE_URL` (variável entrou no guia).

## Task 7 — Pré-merge

- [ ] pgTAP, Vitest, Playwright (E2E novo: atendente envia orçamento → cliente aprova pelo link num contexto anônimo → OS aprovada), `tsc`, lint, build; pegadinhas em `docs/implantacao.md`; PR.
