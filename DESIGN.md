# Gestow — sistema de design

A planta visual do produto. **Todo módulo novo se constrói em cima deste documento.**
Se algo aqui não responde sua dúvida, a regra é: olhe como o módulo Configurações já faz
e siga igual, depois registre aqui.

---

## 1. O que é o produto, e para quem

**Gestow** é o sistema que o lojista usa para tocar a loja: ordens de serviço, estoque,
vendas, fornecedores e financeiro. O cliente final é um **lojista pequeno** (assistência
técnica de celular, no começo), que usa **no balcão, com pressa, muitas vezes no celular**,
às vezes com o cliente dele esperando na frente.

O produto é **white-label**: o lojista vê "Gestow" e mais nada. A infraestrutura
(Supabase, Netlify, WhatsApp/Datafy) nunca aparece para ele, em nenhum texto de tela.

### Modo da interface: **Operar**

O visitante vem **cumprir uma tarefa**, não ser convencido nem entretido. Isso define a régua:

- **Legibilidade e previsibilidade ganham de expressão.** Nada de efeito que atrase a tarefa.
- **Padrões que a pessoa já conhece têm valor.** Um formulário parece um formulário.
- **A marca vive na precisão dos detalhes** — na paleta, no espaçamento, no texto certo —
  não em firulas.
- Ambição, aqui, se mostra como **restrição e acabamento**.

---

## 2. Identidade

| Item | Valor |
|---|---|
| Nome | **Gestow** (`NOME_SISTEMA` em `src/lib/marca.ts`) |
| Descrição | `DESCRICAO_SISTEMA` — uma linha, usada na aba e nas telas de entrada |
| Assinatura | `<Marca />` (`src/components/Marca.tsx`) — só nas telas de entrada |

O nome **nunca** é escrito solto no meio do código: importe de `@/lib/marca`. Trocar o nome
deve ser uma edição em um arquivo só.

Dentro do app a marca já vive no trilho lateral / topo, então **não se repete** nas telas.
`<Marca />` é para login, definir senha, sem acesso e loja suspensa.

---

## 3. Paleta

A paleta é a **"balcão"**: verde-petróleo de confiança, âmbar de sinal (o mesmo amarelo das
etiquetas de conserto penduradas no aparelho) e cinzas levemente esverdeados.

**Regra absoluta: componente nenhum usa cor solta.** Nada de `bg-black`, `text-red-600`,
`#hex` no meio do JSX. Tudo sai dos tokens de `src/app/globals.css`, que já têm versão
clara **e** escura. Uma cor crua quebra o tema escuro e é considerada defeito.

| Token | Para que serve |
|---|---|
| `papel` | fundo da página |
| `superficie` | cartões, topo, barra inferior |
| `superficie-2` | hover, linha zebrada, campo desabilitado |
| `tinta` | texto principal |
| `tinta-suave` | texto secundário, dica, legenda |
| `linha` | bordas de cartão |
| `linha-forte` | borda de campo (contraste suficiente) |
| `marca` / `marca-forte` / `sobre-marca` | ação principal e seu hover |
| `marca-suave` | fundo de item ativo, aviso de sucesso |
| `sinal` / `sinal-suave` | âmbar: atenção, faixa de modo suporte |
| `perigo` / `perigo-suave` | erro, ação destrutiva, asterisco de obrigatório |
| `trilho` / `sobre-trilho` / `trilho-ativo` | barra lateral no computador |
| `foco` | anel de foco do teclado |
| `folha` / `sobre-folha` / `folha-suave` / `folha-linha` | documento impresso (termo, comprovante): papel claro **nos dois temas**, de propósito |

Cada token tem par claro/escuro definido em `:root` e em `@media (prefers-color-scheme: dark)`.
**Ao criar um token novo, defina os dois.**

---

## 4. Tipografia — três vozes

O sistema fala em três vozes. É isso, mais que qualquer efeito, que dá ar de instrumento
profissional em vez de formulário genérico. **Use as três** — uma tela só com a fonte de
texto fica sem relevo.

| Voz | Fonte | Uso |
|---|---|---|
| **Título** | Bricolage Grotesque (`font-titulo`) | `h1`, `h2`, título de cartão, marca, **e os números** |
| **Texto** | Figtree (`font-sans`, padrão) | corpo, descrição, rótulo de campo |
| **Mono** | JetBrains Mono (`font-mono`) | sobrancelha, cabeçalho de tabela, chip, código |

- Corpo de texto em `text-base` (16px). **Nunca** diminua campo de formulário abaixo de 16px:
  no iPhone, fonte menor que isso faz a tela dar zoom sozinha ao focar o campo.
- A mono é para **rótulo**, nunca para texto corrido.

### 4.1 `.sobrancelha` — o rótulo que organiza tudo

Mono, 11px, caixa-alta, `letter-spacing: .14em`, cor `tinta-suave`. Usada em:
cabeçalho de tabela, nome de campo no cartão do celular, rótulo de seção,
rótulo de indicador, subtítulo da marca no topo.

```tsx
<Sobrancelha>Ir para</Sobrancelha>        {/* solta */}
<Cartao etiqueta="Hoje" titulo="Avisos">  {/* dentro do cartão */}
```

Ela **separa o rótulo do dado sem competir com ele**. Antes de escrever um rótulo cinza
qualquer, pergunte se não é uma sobrancelha.

### 4.2 `.numeros` — todo número que vale uma olhada

Dinheiro, quantidade, nº de OS, IMEI, data. Usa a **fonte de título**, tabular e com
leve aperto. Colunas de números alinham e leem como painel de instrumento.

```tsx
<span className="numeros">R$ 1.240,00</span>
```

Na `TabelaResponsiva`, a coluna com `alinhar: 'direita'` já recebe `.numeros` sozinha.

---

## 5. Componentes

Tudo em `src/components/ui/`. **Antes de escrever um componente novo, verifique se já existe.**

| Componente | Quando usar |
|---|---|
| `Cartao` | agrupar um bloco com título, `etiqueta` (sobrancelha) e ações opcionais |
| `Sobrancelha` | rótulo curto de seção, fora de cartão |
| `Indicador` / `Indicadores` | número que vale uma olhada (prontos, estoque baixo, venda do dia) |
| `Campo` | qualquer entrada de texto/número/data — já traz rótulo, dica, erro e acessibilidade |
| `Rotulo` | rótulo de `select`, `textarea` ou grupo — para casar com o `Campo` |
| `Botao` | qualquer ação; variantes `primario`, `secundario`, `perigo`, `discreto` |
| `BotaoEnviar` | botão de envio em formulário com Server Action (detecta o envio sozinho) |
| `Roda` | indicador de carregando fora de botão (ex.: "Validando…") |
| `Alerta` / `Aviso` / `Retorno` | erro / sucesso / resultado de uma ação |
| `Selo` | estado curto (situação da loja, etiqueta) |
| `TabelaResponsiva` | lista tabular que precisa funcionar no celular |
| `CaixaLink` | mostrar um link para copiar (com reserva: se o copiar falhar, seleciona o texto) |
| `EmBreve` | módulo ainda não construído |

`classesBotao()` existe para dar aparência de botão a um `<Link>` — **não** recrie as classes
na mão.

### 5.1 Profundidade: `.realce` e `.vidro`

- **`.realce`** — fio de luz na borda de cima + sombra mínima. Vai em **todo** cartão,
  indicador e tabela. Dá volume sem sombra pesada, e funciona nos dois temas.
- **`.vidro`** — fundo translúcido com desfoque, para superfície **fixa** sob a qual o
  conteúdo rola (topo fixo, barra inferior do celular). Área pequena de propósito:
  desfoque custa caro no celular. **Não** use em cartão comum.

O fundo da página tem um gradiente radial bem leve (verde no alto, âmbar embaixo). Não é
decoração: é o que impede a tela de parecer um papel chapado. Já vem no `body`.

### 5.2 Indicador (KPI)

```tsx
<Indicadores>
  <Indicador rotulo="Prontos para entrega" valor={8} href="/servico?estado=pronto" />
  <Indicador rotulo="Estoque acabando" valor={3} tom="aviso" />
  <Indicador rotulo="Vendas hoje" valor="R$ 1.240,00" tom="marca" detalhe="4 vendas" />
</Indicadores>
```

Regra dura: **indicador mostra número real**. Se o dado ainda não existe, não coloque o
indicador na tela — número inventado em painel é pior que painel vazio.

---

## 6. Padrões obrigatórios

### 6.1 Estado de carregando — **toda** ação que espera o servidor

Nenhuma ação pode deixar a tela parada sem resposta. O usuário aperta, e **imediatamente**
vê que algo está acontecendo. Isso vale para salvar, criar, gerar link, entrar, sair.

Dois casos, dois jeitos:

**Formulário com Server Action** (`<form action={minhaAcao}>`) — use `BotaoEnviar`,
que descobre sozinho:

```tsx
<form action={entrar}>
  …
  <BotaoEnviar rotuloCarregando="Entrando…">Entrar</BotaoEnviar>
</form>
```

**Formulário com `onSubmit` + `useTransition`** — passe o estado:

```tsx
const [pendente, iniciar] = useTransition()
…
<Botao type="submit" carregando={pendente} rotuloCarregando="Salvando…">
  Salvar
</Botao>
```

O `Botao` com `carregando`:
- mostra a `Roda`,
- **desabilita sozinho** (não escreva `disabled={pendente}` junto — só mantenha outras
  condições, ex.: `disabled={!formularioValido}`),
- marca `aria-busy`.

**Espera que não é de botão** (validar um link, carregar uma tela): use `Roda` com um texto,
dentro de `role="status"`:

```tsx
<p role="status" className="flex items-center gap-2 text-tinta-suave">
  <Roda /> Validando o seu link…
</p>
```

A `Roda` **some** com "reduzir movimento" ligado — por isso o texto ao lado nunca é opcional:
é ele que informa quem não vê animação.

**Tela que busca dados no servidor** usa `<Suspense>` com um esqueleto ou um "Carregando…"
em `text-tinta-suave`. Nunca deixe a área em branco.

### 6.2 Campo obrigatório — marque a **exceção**, não a regra

Marcar todo campo com `*` não informa nada: vira ruído e não distingue um do outro.

| Situação do formulário | O que fazer |
|---|---|
| **Tudo** é obrigatório | `<TodosObrigatorios />` no topo: "Todos os campos são obrigatórios." |
| Quase tudo obrigatório, poucos opcionais | marque os opcionais: `<Campo opcional … />` → "(opcional)" |
| Quase tudo opcional, poucos obrigatórios | marque os obrigatórios: `<Campo marcarObrigatorio … />` → `*` |
| Óbvio pelo contexto (login) | não marque nada |

O `*` é só visual (`aria-hidden`). Quem usa leitor de tela já ouve "obrigatório" do
`required` do próprio campo — por isso **o `required` no input nunca é dispensado**.

### 6.3 Resultado de ação

- Erro: `<Alerta>` (tem `role="alert"`, é anunciado).
- Sucesso: `<Aviso>` (tem `role="status"`).
- Os dois juntos num estado: `<Retorno msg={msg} />`.

Mensagem de erro fala **o que fazer**, não o que quebrou. "Peça um novo link para quem te
convidou" vale mais que "token inválido". Nunca vaze nome de tabela, de serviço ou código
de erro para a tela.

### 6.4 Formulário desabilitado

Só `<fieldset disabled>` desabilita de verdade os filhos. Pôr uma classe no pai **não**
cascateia. É assim que o modo suporte e o modo somente-leitura funcionam.

---

## 7. Acessibilidade e toque — a régua mínima

Não é enfeite: o lojista usa no celular, com uma mão, às vezes com a tela trincada.

- **Alvo de toque de no mínimo 44px**: `min-h-11` em botão e campo. Já vem nos componentes.
- **Foco sempre visível no teclado**: já global em `:focus-visible`. Nunca escreva
  `outline: none`.
- **Contraste**: os tokens já foram escolhidos com contraste conferido nos dois temas.
  Ao combinar tokens novos, confira.
- **Reduzir movimento**: respeitado globalmente. Toda animação precisa ter uma versão sem
  movimento que ainda informe.
- **Rótulo de verdade**: todo campo tem `<label>` ligado por `htmlFor`. Placeholder **não**
  é rótulo.
- **Funciona no celular**: nada de largura fixa que estoure; tabela usa `TabelaResponsiva`.

---

## 8. Texto de tela

- Português do Brasil, **tratamento direto** ("Salvar", "Criar loja"), sem "por favor".
- O vocabulário é o **do balcão**, não o do banco de dados: "aparelho", "conserto", "cliente",
  "Dono" — nunca "registro", "entidade", "tupla".
- Botão diz **a ação** ("Salvar serviço"), não "OK".
- Reticências `…` (um caractere) no rótulo de espera: "Salvando…".

---

## 9. Checklist para um módulo novo

Antes de dar um módulo por pronto:

- [ ] Nenhuma cor crua — só tokens (`text-white` e `bg-black` contam como cor crua).
- [ ] As três vozes tipográficas aparecem: título, texto e **mono** (§4).
- [ ] Rótulos de tabela/seção são sobrancelha; números usam `.numeros`.
- [ ] Cartões, tabelas e indicadores levam `.realce`.
- [ ] Toda ação que espera servidor tem estado de carregando (§6.1).
- [ ] Toda tela que busca dados tem `<Suspense>` com aviso — nunca área em branco.
- [ ] Campos obrigatórios tratados pela regra da exceção (§6.2).
- [ ] Erros com `<Alerta>`, dizendo o que fazer.
- [ ] Componentes reaproveitados de `ui/` — nenhum botão ou campo feito na mão.
- [ ] Testado em largura de celular (~400px), sem rolagem horizontal.
- [ ] Testado nos dois temas (claro e escuro).
- [ ] Estado vazio pensado ("Nada por aqui ainda" + o que fazer para começar).
- [ ] Nenhum termo de infraestrutura visível ao lojista.
