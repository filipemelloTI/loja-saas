begin;
select plan(13);

-- Só nesta transação (rollback no fim): permite trocar de usuário
-- estando já no papel authenticated.
grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

-- Cenário: lojas A e B; dono, técnico e atendente em A; dono em B; admin.
create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('dono_a',      testes.criar_usuario('dono.a@teste.local')),
  ('tecnico_a',   testes.criar_usuario('tecnico.a@teste.local')),
  ('atendente_a', testes.criar_usuario('atendente.a@teste.local')),
  ('dono_b',      testes.criar_usuario('dono.b@teste.local')),
  ('admin',       testes.criar_usuario('admin@teste.local'));

insert into planos (nome, modulos, limite_usuarios)
values ('Teste', '{servico}', 5);

with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'Teste'
  returning id)
insert into ids select 'loja_a', id from l;
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'Teste'
  returning id)
insert into ids select 'loja_b', id from l;

insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),      'Dono A',      'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'tecnico_a'),   'Técnico A',   'tecnico'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atendente_a'), 'Atendente A', 'atendente'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'),      'Dono B',      'dono');

insert into admins_plataforma (user_id) select id from ids where chave = 'admin';

select ok(
  (select relrowsecurity from pg_class where oid = 'public.clientes'::regclass),
  'clientes tem RLS habilitada');

-- Atendente A -----------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'atendente_a'));

select lives_ok(
  format($$insert into clientes (loja_id, nome, telefone)
           values (%L, 'Maria Cliente', '11999990000')$$,
         (select id from ids where chave = 'loja_a')),
  'Atendente A insere um cliente na própria loja');

select is((select count(*) from clientes), 1::bigint,
  'Atendente A lê o próprio cliente');

-- Técnico A -------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'tecnico_a'));

select is((select count(*) from clientes), 1::bigint,
  'Técnico A lê o cliente da loja');

-- Dono A ----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));

select results_eq(
  $$update clientes set nome = 'Maria C.' returning nome$$,
  array['Maria C.'],
  'Dono A atualiza o cliente da própria loja');

-- Dono B ----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));

select is_empty('select * from clientes',
  'Dono B não enxerga o cliente da loja A');

select is_empty(
  $$update clientes set nome = 'x' returning id$$,
  'Dono B não atualiza o cliente da loja A');

select is_empty(
  $$delete from clientes returning id$$,
  'Dono B não apaga o cliente da loja A');

select throws_ok(
  format($$insert into clientes (loja_id, nome, telefone)
           values (%L, 'Intruso', '11000000000')$$,
         (select id from ids where chave = 'loja_a')),
  '42501', null,
  'Dono B não insere cliente na loja A');

-- Admin suspende a loja A -----------------------------------------------
select testes.entrar_como((select id from ids where chave = 'admin'));
update lojas set situacao = 'suspensa' where id = (select id from ids where chave = 'loja_a');

select testes.entrar_como((select id from ids where chave = 'dono_a'));

select is((select count(*) from clientes), 0::bigint,
  'Loja suspensa: Dono A não lê clientes');

select throws_ok(
  format($$insert into clientes (loja_id, nome, telefone)
           values (%L, 'Bloqueado', '11111111111')$$,
         (select id from ids where chave = 'loja_a')),
  '42501', null,
  'Loja suspensa: Dono A não escreve clientes');

-- Reativa A e Dono A libera suporte -------------------------------------
select testes.entrar_como((select id from ids where chave = 'admin'));
update lojas set situacao = 'em_dia' where id = (select id from ids where chave = 'loja_a');

select testes.entrar_como((select id from ids where chave = 'dono_a'));
insert into acessos_suporte (loja_id, expira_em)
values ((select id from ids where chave = 'loja_a'), now() + interval '24 hours');

-- Admin em suporte ------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'admin'));

select is((select count(*) from clientes), 1::bigint,
  'Admin em suporte lê os clientes de A');

select throws_ok(
  format($$insert into clientes (loja_id, nome, telefone)
           values (%L, 'Suporte', '11222222222')$$,
         (select id from ids where chave = 'loja_a')),
  '42501', null,
  'Admin em suporte não insere cliente');

select * from finish();
rollback;
