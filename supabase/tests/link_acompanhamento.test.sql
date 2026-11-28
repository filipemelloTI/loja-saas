-- Link público: token, o que aparece e o que nunca aparece, resposta do
-- cliente ao orçamento, loja suspensa.
begin;
select plan(20);

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to anon;

insert into ids values ('dono_a', testes.criar_usuario('dono.a@teste.local'));
insert into planos (nome, modulos, limite_usuarios) values ('TesteLink', '{servico}', 5);
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja Link', id, '{servico}' from planos where nome = 'TesteLink' returning id)
insert into ids select 'loja_a', id from l;
insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'), 'Dono A', 'dono');
update config_loja set telefone = '1333334444', endereco = 'Rua A, 1'
  where loja_id = (select id from ids where chave = 'loja_a');

insert into clientes (loja_id, nome, telefone, cpf) values
  ((select id from ids where chave = 'loja_a'), 'Maria Souza', '13999990000', '52998224725');
insert into ordens_servico (loja_id, cliente_id, aparelho_tipo, marca, modelo, defeito_relatado, observacao) values
  ((select id from ids where chave = 'loja_a'), (select id from clientes where nome = 'Maria Souza'),
   'celular', 'Apple', 'iPhone 11', 'Tela', 'nota interna secreta');
insert into ids select 'os_a', id from ordens_servico where observacao = 'nota interna secreta';
update ordens_servico set status = 'orcamento_enviado' where id = (select id from ids where chave = 'os_a');

insert into os_orcamentos (loja_id, os_id, status) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a'), 'enviado');
insert into ids select 'orc_a', id from os_orcamentos where os_id = (select id from ids where chave = 'os_a');
insert into os_orcamento_itens (orcamento_id, loja_id, descricao, preco_unitario) values
  ((select id from ids where chave = 'orc_a'), (select id from ids where chave = 'loja_a'), 'Troca de tela', 300);
insert into os_pecas (loja_id, os_id, descricao, preco_unitario) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a'), 'Tela', 350);
-- A peça só tem custo por servidor; custo NÃO pode sair no link.
alter table os_pecas disable trigger pecas_so_com_orcamento_aberto;
insert into os_pecas_custo (peca_id, loja_id, custo_unitario)
  select id, loja_id, 280 from os_pecas where os_id = (select id from ids where chave = 'os_a');
alter table os_pecas enable trigger pecas_so_com_orcamento_aberto;

create temp table tok (t text, numero int) on commit drop;
grant select on tok to anon;
insert into tok select token_publico, numero from ordens_servico where id = (select id from ids where chave = 'os_a');

-- Token ----------------------------------------------------------------------
select ok((select t from tok) ~ '^[0-9a-f]{48}$', 'Token tem 48 caracteres hex');
select col_is_unique('public', 'ordens_servico', 'token_publico', 'Token é único');

-- Visitante anônimo ------------------------------------------------------------
set local role anon;
select is_empty($$select id from ordens_servico$$, 'Anônimo não vê nenhuma OS na tabela');
select is(acompanhamento_os('naoexiste'), null, 'Token fora do formato: nada');
select is(acompanhamento_os(repeat('a', 48)), null, 'Token inexistente: nada');

select is(acompanhamento_os((select t from tok)) -> 'os' ->> 'numero',
  (select numero::text from tok),
  'Link mostra o número da OS');
select is(acompanhamento_os((select t from tok)) ->> 'cliente', 'Maria', 'Só o primeiro nome do cliente');
select is(acompanhamento_os((select t from tok)) -> 'loja' ->> 'telefone', '1333334444', 'Mostra o contato da loja');
select is(jsonb_array_length(acompanhamento_os((select t from tok)) -> 'orcamento' -> 'itens'), 1, 'Mostra os itens do orçamento');
select is(acompanhamento_os((select t from tok)) -> 'pecas' -> 0 ->> 'preco_unitario', '350.00', 'Peça pelo preço cobrado');

select ok(
  position('52998224725' in acompanhamento_os((select t from tok))::text) = 0
  and position('custo' in acompanhamento_os((select t from tok))::text) = 0
  and position(': 280' in acompanhamento_os((select t from tok))::text) = 0
  and position('nota interna' in acompanhamento_os((select t from tok))::text) = 0
  and position('cpf' in acompanhamento_os((select t from tok))::text) = 0
  and position('senha' in acompanhamento_os((select t from tok))::text) = 0,
  'Nunca sai CPF, custo, observação interna ou senha');

-- Resposta ---------------------------------------------------------------------
select throws_ok(
  format($$select responder_orcamento_pelo_link(%L, %L, true, '  ')$$, (select t from tok), (select id from ids where chave = 'orc_a')),
  'P0001', 'Informe seu nome para aprovar.', 'Aprovar exige o nome');
select throws_ok(
  format($$select responder_orcamento_pelo_link(%L, gen_random_uuid(), true, 'Maria')$$, (select t from tok)),
  'P0001', 'O orçamento foi atualizado. Recarregue a página.', 'Orçamento que a página não mostrou é recusado');
select lives_ok(
  format($$select responder_orcamento_pelo_link(%L, %L, true, 'Maria Souza')$$, (select t from tok), (select id from ids where chave = 'orc_a')),
  'Cliente aprova pelo link');
select throws_ok(
  format($$select responder_orcamento_pelo_link(%L, %L, true, 'Maria Souza')$$, (select t from tok), (select id from ids where chave = 'orc_a')),
  'P0001', 'Este orçamento já foi respondido.', 'Segundo toque em Aprovar é recusado');
reset role;

select is(
  (select row(status, aprovado_meio, aprovado_por)::text from os_orcamentos where id = (select id from ids where chave = 'orc_a')),
  '(aprovado,link,"Maria Souza")', 'Aprovação guarda meio link e o nome digitado');
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_a')),
  'aprovado', 'A OS passa para aprovado');
select is(
  (select observacao from os_historico where os_id = (select id from ids where chave = 'os_a') and para_status = 'aprovado'),
  'Orçamento v1 aprovado pelo link por Maria Souza', 'Histórico diz que foi pelo link');

-- Recusa pelo link numa segunda OS; e loja suspensa derruba o link --------
insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado, observacao, status) values
  ((select id from ids where chave = 'loja_a'), true, 'celular', 'Som', 'segunda', 'orcamento_enviado');
insert into os_orcamentos (loja_id, os_id, status)
  select loja_id, id, 'enviado' from ordens_servico where observacao = 'segunda';
create temp table seg (t text, orc uuid) on commit drop;
grant select on seg to anon;
insert into seg select s.token_publico, o.id from ordens_servico s join os_orcamentos o on o.os_id = s.id
  where s.observacao = 'segunda';
set local role anon;
select lives_ok(
  format($$select responder_orcamento_pelo_link(%L, %L, false)$$, (select t from seg), (select orc from seg)),
  'Cliente recusa pelo link sem informar nome');
reset role;

update lojas set situacao = 'suspensa' where id = (select id from ids where chave = 'loja_a');
set local role anon;
select is(acompanhamento_os((select t from tok)), null, 'Loja suspensa: o link para de responder');
reset role;

select * from finish();
rollback;
