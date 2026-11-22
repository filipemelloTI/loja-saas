begin;
select plan(17);

-- Só nesta transação (rollback no fim): permite trocar de usuário
-- estando já no papel authenticated.
grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

-- Cenário: lojas A e B; dono e técnico em A; dono em B; admin da plataforma.
create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('dono_a',    testes.criar_usuario('dono.a@teste.local')),
  ('tecnico_a', testes.criar_usuario('tecnico.a@teste.local')),
  ('dono_b',    testes.criar_usuario('dono.b@teste.local')),
  ('admin',     testes.criar_usuario('admin@teste.local'));

insert into planos (nome, modulos, limite_usuarios)
values ('Teste', '{servico,estoque}', 3);

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
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),    'Dono A',    'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'tecnico_a'), 'Técnico A', 'tecnico'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'),    'Dono B',    'dono');

insert into admins_plataforma (user_id) select id from ids where chave = 'admin';

-- Dono A ----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));

select is((select count(*) from lojas), 1::bigint,
  'Dono A vê só a própria loja');

select is_empty(
  format('select * from membros where loja_id = %L', (select id from ids where chave = 'loja_b')),
  'Dono A não vê membros da loja B');

select throws_ok(
  $$update lojas set situacao = 'suspensa' returning id$$,
  '42501', null,
  'Dono A não altera a situação da loja');

select results_eq(
  $$update lojas set nome = 'Loja A2' returning nome$$,
  array['Loja A2'],
  'Dono A altera o nome da própria loja');

-- Técnico A -------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'tecnico_a'));

select is_empty(
  $$update lojas set nome = 'x' returning id$$,
  'Técnico A não altera a loja');

-- Admin da plataforma (sem suporte) -------------------------------------
select testes.entrar_como((select id from ids where chave = 'admin'));

select throws_ok(
  format($$insert into lojas (nome, plano_id, modulos)
           values ('Sem estoque', %L, '{vendas}')$$,
         (select id from planos where nome = 'Teste')),
  '23514', null,
  'Vendas sem Estoque é rejeitado (CHECK)');

select is_empty('select * from membros',
  'Admin sem suporte não lê membros');

select results_eq(
  format($$update lojas set situacao = 'suspensa' where id = %L returning id$$,
         (select id from ids where chave = 'loja_a')),
  format('select %L::uuid', (select id from ids where chave = 'loja_a')),
  'Admin suspende a loja A');

-- Loja A suspensa -------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));

select is((select count(*) from lojas), 0::bigint,
  'Loja suspensa: Dono A vê 0 lojas');
select is((select count(*) from membros), 0::bigint,
  'Loja suspensa: Dono A vê 0 membros');
select is(situacao_da_minha_loja(), 'suspensa'::situacao_loja,
  'situacao_da_minha_loja() informa suspensa');

-- Reativa A e Dono A libera acesso de suporte por 24h -------------------
select testes.entrar_como((select id from ids where chave = 'admin'));
update lojas set situacao = 'em_dia' where id = (select id from ids where chave = 'loja_a');

select testes.entrar_como((select id from ids where chave = 'dono_a'));
insert into acessos_suporte (loja_id, expira_em)
values ((select id from ids where chave = 'loja_a'), now() + interval '24 hours');

-- Admin em suporte ------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'admin'));

select is(
  (select count(*) from lojas where id = (select id from ids where chave = 'loja_a')),
  1::bigint,
  'Admin em suporte lê a loja A');
select is((select count(*) from membros), 2::bigint,
  'Admin em suporte lê os membros de A (e só de A)');
select is(meu_perfil(), 'dono'::perfil,
  'Admin em suporte tem perfil dono (só leitura)');
select is_empty(
  $$update lojas set nome = 'x' returning id$$,
  'Admin em suporte não altera a loja');

-- Suporte expirado ------------------------------------------------------
select testes.sair();
update acessos_suporte set expira_em = now() - interval '1 hour';

select testes.entrar_como((select id from ids where chave = 'admin'));
select is((select count(*) from membros), 0::bigint,
  'Suporte expirado: admin vê 0 membros');

-- Auditoria -------------------------------------------------------------
select testes.sair();
select ok(exists(
  select 1 from auditoria
  where tabela = 'lojas' and acao = 'update'
    and user_id = (select id from ids where chave = 'dono_a')
    and detalhes -> 'depois' ->> 'nome' = 'Loja A2'),
  'Auditoria registra quem alterou a loja');

select * from finish();
rollback;
