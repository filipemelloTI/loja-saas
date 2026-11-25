begin;
select plan(14);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('dono_a',  testes.criar_usuario('dono.a@teste.local')),
  ('dono_b',  testes.criar_usuario('dono.b@teste.local')),
  ('admin',   testes.criar_usuario('admin@teste.local'));

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
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'), 'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'), 'Dono B', 'dono');
insert into ids select 'membro_a', id from membros where user_id = (select id from ids where chave = 'dono_a');

insert into admins_plataforma (user_id) select id from ids where chave = 'admin';

with o as (
  insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
  values ((select id from ids where chave = 'loja_a'), true, 'celular', 'OS A1')
  returning id)
insert into ids select 'os_a1', id from o;

-- Privilégios -------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.mudar_status_os(uuid, public.status_os, text)', 'execute')
  and not has_function_privilege('anon', 'public.mudar_status_os(uuid, public.status_os, text)', 'execute'),
  'só authenticated executa mudar_status_os');
select ok(
  not (select prosecdef from pg_proc where oid = 'public.mudar_status_os(uuid, public.status_os, text)'::regprocedure),
  'mudar_status_os é security invoker (a RLS continua valendo)');

-- Outra loja não move a OS ------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));
select throws_ok(
  format($$select mudar_status_os(%L, 'em_analise', 'invasão')$$, (select id from ids where chave = 'os_a1')),
  'P0001', 'OS não encontrada', 'Dono B não move a OS da loja A');
select testes.sair();
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_a1')),
  'aberta', 'OS da loja A segue em "aberta" após a tentativa do Dono B');
select is(
  (select count(*) from os_historico where os_id = (select id from ids where chave = 'os_a1')),
  0::bigint, 'a tentativa do Dono B não deixou histórico');

-- OS inexistente ----------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select throws_ok(
  $$select mudar_status_os('00000000-0000-0000-0000-000000000000', 'em_analise')$$,
  'P0001', 'OS não encontrada', 'OS inexistente dá o erro em português');

-- Mudança de verdade ------------------------------------------------------
select lives_ok(
  format($$select mudar_status_os(%L, 'em_analise', 'chegou na bancada')$$, (select id from ids where chave = 'os_a1')),
  'Dono A muda o status da própria OS');
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_a1')),
  'em_analise', 'o status realmente mudou');
select is(
  (select count(*) from os_historico where os_id = (select id from ids where chave = 'os_a1')),
  1::bigint, 'exatamente uma linha de histórico');
select is(
  (select de_status::text || '>' || para_status::text || '|' || observacao
   from os_historico where os_id = (select id from ids where chave = 'os_a1')),
  'aberta>em_analise|chegou na bancada', 'histórico traz de, para e observação');
select is(
  (select membro_id from os_historico where os_id = (select id from ids where chave = 'os_a1')),
  (select id from ids where chave = 'membro_a'), 'histórico traz o membro da sessão');

-- Segunda mudança: de_status é o status anterior --------------------------
select mudar_status_os((select id from ids where chave = 'os_a1'), 'aprovado');
select is(
  (select array_agg(de_status::text || '>' || para_status::text order by para_status)
   from os_historico where os_id = (select id from ids where chave = 'os_a1')),
  array['aberta>em_analise', 'em_analise>aprovado'], 'a segunda mudança parte do status anterior');

-- Admin em suporte não escreve --------------------------------------------
insert into acessos_suporte (loja_id, expira_em)
values ((select id from ids where chave = 'loja_a'), now() + interval '24 hours');
select testes.entrar_como((select id from ids where chave = 'admin'));
select throws_ok(
  format($$select mudar_status_os(%L, 'em_servico')$$, (select id from ids where chave = 'os_a1')),
  'P0001', 'OS não encontrada', 'admin em suporte não muda o status');
select testes.sair();
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_a1')),
  'aprovado', 'o status segue "aprovado" após a tentativa do suporte');

select * from finish();
rollback;
