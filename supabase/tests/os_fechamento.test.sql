-- Fechamento da OS (custo, comissão, lucro): só o Dono lê; ninguém grava
-- pela API; as colunas antigas saíram da OS.
begin;
select plan(8);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('dono_a',  testes.criar_usuario('dono.a@teste.local')),
  ('atend_a', testes.criar_usuario('atend.a@teste.local')),
  ('tec_a',   testes.criar_usuario('tec.a@teste.local')),
  ('dono_b',  testes.criar_usuario('dono.b@teste.local'));

insert into planos (nome, modulos, limite_usuarios) values ('TesteFech', '{servico}', 5);
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteFech' returning id)
insert into ids select 'loja_a', id from l;
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TesteFech' returning id)
insert into ids select 'loja_b', id from l;
insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),  'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'tec_a'),   'Tec A', 'tecnico'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'),  'Dono B', 'dono');

insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'), true, 'celular', 'Tela');
insert into ids select 'os_a', id from ordens_servico where loja_id = (select id from ids where chave = 'loja_a');

-- O servidor grava o fechamento (como a entregar_os faria).
insert into os_fechamento (os_id, loja_id, total, custo_pecas, comissao_percentual, comissao, lucro)
values ((select id from ids where chave = 'os_a'), (select id from ids where chave = 'loja_a'), 650, 280, 30, 111, 259);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.os_fechamento'::regclass),
  'os_fechamento tem RLS habilitada');
select hasnt_column('public', 'ordens_servico', 'lucro_congelado',
  'O lucro não fica mais na OS, que todos os perfis leem');

select testes.entrar_como((select id from ids where chave = 'dono_a'));
select is((select lucro from os_fechamento), 259.00::numeric, 'Dono lê o lucro da OS');
select throws_ok(
  $$update os_fechamento set lucro = 9999$$,
  '42501', null, 'Nem o Dono altera o fechamento');
select testes.sair();

select testes.entrar_como((select id from ids where chave = 'atend_a'));
select is_empty($$select os_id from os_fechamento$$, 'Atendente não lê o fechamento');
select throws_ok(
  format($$insert into os_fechamento (os_id, loja_id, total, custo_pecas, comissao_percentual, comissao, lucro)
           values (%L, %L, 1, 0, 0, 0, 1)$$,
    (select id from ids where chave = 'os_a'), (select id from ids where chave = 'loja_a')),
  '42501', null, 'Atendente não grava fechamento');
select testes.sair();

select testes.entrar_como((select id from ids where chave = 'tec_a'));
select is_empty($$select os_id from os_fechamento$$, 'Técnico não lê o fechamento');
select testes.sair();

select testes.entrar_como((select id from ids where chave = 'dono_b'));
select is_empty($$select os_id from os_fechamento$$, 'Outra loja não lê o fechamento');
select testes.sair();

select * from finish();
rollback;
