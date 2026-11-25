-- TRUNCATE revogado de authenticated e anon no schema `public`.
-- A RLS filtra DELETE por loja, mas TRUNCATE a ignora e apagaria tudo. Como a
-- concessão padrão do Supabase inclui TRUNCATE, precisamos provar que ela não
-- volta sozinha nem numa tabela nova criada depois.
begin;
select plan(4);

-- Tabelas existentes: TRUNCATE deve dar erro de permissão, não "RLS escondeu".
set local role authenticated;
select throws_ok(
  $$truncate table public.ordens_servico$$,
  '42501', null,
  'authenticated não consegue TRUNCATE em ordens_servico');
select throws_ok(
  $$truncate table public.os_historico$$,
  '42501', null,
  'authenticated não consegue TRUNCATE no histórico (que não pode perder linha)');

reset role;

-- Tabela nova: a partir dos default privileges, a próxima tabela em `public`
-- nasce já com TRUNCATE revogado de authenticated e anon.
create table public.tabela_tmp_truncate (id int);

set local role authenticated;
select throws_ok(
  $$truncate table public.tabela_tmp_truncate$$,
  '42501', null,
  'default privileges: TRUNCATE nasce revogado em tabela nova');

set local role anon;
select throws_ok(
  $$truncate table public.tabela_tmp_truncate$$,
  '42501', null,
  'default privileges: anon também fica sem TRUNCATE em tabela nova');

reset role;
-- Limpeza da tabela criada só para esta prova.
drop table public.tabela_tmp_truncate;

select * from finish();
rollback;
