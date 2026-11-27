-- pecas_sem_custo: o técnico sabe quantas peças esperam o custo, sem ver o
-- valor; outra loja recebe zero.
begin;
select plan(4);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('dono_a', testes.criar_usuario('dono.a@teste.local')),
  ('tec_a',  testes.criar_usuario('tec.a@teste.local')),
  ('dono_b', testes.criar_usuario('dono.b@teste.local'));

insert into planos (nome, modulos, limite_usuarios) values ('TesteSemCusto', '{servico}', 5);
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteSemCusto' returning id)
insert into ids select 'loja_a', id from l;
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TesteSemCusto' returning id)
insert into ids select 'loja_b', id from l;

insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'), 'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'tec_a'),  'Tec A', 'tecnico'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'), 'Dono B', 'dono');

insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'), true, 'celular', 'Tela');
insert into ids select 'os_a', id from ordens_servico where loja_id = (select id from ids where chave = 'loja_a');

insert into os_pecas (loja_id, os_id, descricao, preco_unitario) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a'), 'Tela', 350),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a'), 'Cola', 20);
insert into os_pecas_custo (peca_id, loja_id, custo_unitario)
  select id, loja_id, 280 from os_pecas where descricao = 'Tela';

select testes.entrar_como((select id from ids where chave = 'tec_a'));
select is(
  pecas_sem_custo((select id from ids where chave = 'os_a')),
  1, 'Técnico vê que uma peça espera o custo');
select is_empty($$select peca_id from os_pecas_custo$$, 'E continua sem ler o valor do custo');
select testes.sair();

select testes.entrar_como((select id from ids where chave = 'dono_b'));
select is(
  pecas_sem_custo((select id from ids where chave = 'os_a')),
  0, 'Outra loja recebe zero');
select testes.sair();

select throws_ok(
  $$set local role anon; select public.pecas_sem_custo(gen_random_uuid())$$,
  '42501', null, 'Sem login, a função nem roda');

select * from finish();
rollback;
