-- Peças da OS lançadas à mão: os três perfis lançam, só o Dono vê e grava custo.
begin;
select plan(15);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('dono_a',  testes.criar_usuario('dono.a@teste.local')),
  ('tec_a',   testes.criar_usuario('tec.a@teste.local')),
  ('atend_a', testes.criar_usuario('atend.a@teste.local')),
  ('dono_b',  testes.criar_usuario('dono.b@teste.local'));

insert into planos (nome, modulos, limite_usuarios)
values ('TestePecas', '{servico}', 5);

with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TestePecas'
  returning id)
insert into ids select 'loja_a', id from l;
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TestePecas'
  returning id)
insert into ids select 'loja_b', id from l;

insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),  'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'tec_a'),   'Tec A', 'tecnico'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'),  'Dono B', 'dono');

insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'), true, 'celular', 'Tela');
insert into ids
  select 'os_a', id from ordens_servico
  where loja_id = (select id from ids where chave = 'loja_a') limit 1;

-- Estrutura ---------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.os_pecas'::regclass),
  'os_pecas tem RLS habilitada');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.os_pecas_custo'::regclass),
  'os_pecas_custo tem RLS habilitada');

-- Restrições ---------------------------------------------------------------
select throws_ok(
  format($$insert into os_pecas (loja_id, os_id, descricao, preco_unitario)
           values (%L, %L, 'Tela', -1)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  '23514', null, 'Peça não aceita preço negativo');
select throws_ok(
  format($$insert into os_pecas (loja_id, os_id, descricao, preco_unitario, quantidade)
           values (%L, %L, 'Tela', 10, 0)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  '23514', null, 'Peça não aceita quantidade zero');
select throws_ok(
  format($$insert into os_pecas (loja_id, os_id, descricao, preco_unitario)
           values (%L, %L, '   ', 10)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  '23514', null, 'Peça não aceita descrição em branco');

-- Técnico lança a peça, mas não vê nem grava custo ----------------------
select testes.entrar_como((select id from ids where chave = 'tec_a'));
select lives_ok(
  format($$insert into os_pecas (loja_id, os_id, descricao, preco_unitario)
           values (%L, %L, 'Tela iPhone 11', 350)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  'Técnico lança peça na OS da própria loja');
select throws_ok(
  format($$insert into os_pecas_custo (peca_id, loja_id, custo_unitario)
           values ((select id from os_pecas where descricao = 'Tela iPhone 11'), %L, 180)$$,
         (select id from ids where chave = 'loja_a')),
  '42501', null, 'Técnico não grava custo da peça');
select testes.sair();

-- Atendente também lança -------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'atend_a'));
select lives_ok(
  format($$insert into os_pecas (loja_id, os_id, descricao, preco_unitario)
           values (%L, %L, 'Película', 30)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  'Atendente lança peça na OS da própria loja');
select testes.sair();

-- Dono grava e lê o custo -------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select lives_ok(
  format($$insert into os_pecas_custo (peca_id, loja_id, custo_unitario)
           values ((select id from os_pecas where descricao = 'Tela iPhone 11'), %L, 180)$$,
         (select id from ids where chave = 'loja_a')),
  'Dono grava custo da peça');
select throws_ok(
  format($$insert into os_pecas_custo (peca_id, loja_id, custo_unitario)
           values ((select id from os_pecas where descricao = 'Película'), %L, -5)$$,
         (select id from ids where chave = 'loja_a')),
  '23514', null, 'Custo não aceita valor negativo');
select is(
  (select count(*)::int from os_pecas_custo),
  1, 'Dono lê o custo gravado');
select testes.sair();

-- Técnico não enxerga o custo que o Dono gravou -------------------------
select testes.entrar_como((select id from ids where chave = 'tec_a'));
select is_empty(
  $$select peca_id from os_pecas_custo$$,
  'Técnico não lê custo de peça');
select is(
  (select count(*)::int from os_pecas),
  2, 'Técnico lê as duas peças da OS (sem custo)');
select testes.sair();

-- Outra loja não vê nada -------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));
select is_empty(
  $$select id from os_pecas$$,
  'Dono B não lê peças da loja A');
select testes.sair();

-- Apagar a peça leva o custo junto ---------------------------------------
delete from os_pecas where descricao = 'Tela iPhone 11' and loja_id = (select id from ids where chave = 'loja_a');
select is(
  (select count(*)::int from os_pecas_custo where loja_id = (select id from ids where chave = 'loja_a')),
  0, 'Apagar a peça apaga o custo dela');

select * from finish();
rollback;
