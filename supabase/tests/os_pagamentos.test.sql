-- Pagamentos da OS: forma ativa na loja, parcelas só no crédito, valor
-- positivo, isolamento por loja e auditoria.
begin;
select plan(12);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('atend_a', testes.criar_usuario('atend.a@teste.local')),
  ('dono_a',  testes.criar_usuario('dono.a@teste.local')),
  ('dono_b',  testes.criar_usuario('dono.b@teste.local'));

insert into planos (nome, modulos, limite_usuarios)
values ('TestePag', '{servico}', 5);

with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TestePag'
  returning id)
insert into ids select 'loja_a', id from l;
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TestePag'
  returning id)
insert into ids select 'loja_b', id from l;

insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),  'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'),  'Dono B', 'dono');

-- A loja A não aceita dinheiro.
update config_loja set formas_pagamento = '{pix,debito,credito}'
  where loja_id = (select id from ids where chave = 'loja_a');

insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'), true, 'celular', 'Tela');
insert into ids
  select 'os_a', id from ordens_servico
  where loja_id = (select id from ids where chave = 'loja_a') limit 1;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.os_pagamentos'::regclass),
  'os_pagamentos tem RLS habilitada');

-- Atendente registra ----------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'atend_a'));

select lives_ok(
  format($$insert into os_pagamentos (loja_id, os_id, tipo, forma, valor)
           values (%L, %L, 'sinal', 'pix', 100)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  'Atendente registra sinal em Pix');
select lives_ok(
  format($$insert into os_pagamentos (loja_id, os_id, tipo, forma, parcelas, valor)
           values (%L, %L, 'final', 'credito', 3, 550)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  'Atendente registra crédito em 3x');
select throws_ok(
  format($$insert into os_pagamentos (loja_id, os_id, tipo, forma, valor)
           values (%L, %L, 'final', 'dinheiro', 50)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  'P0001', 'Esta forma de pagamento não está ativa na loja.',
  'Forma que a loja não aceita é recusada');
select throws_ok(
  format($$insert into os_pagamentos (loja_id, os_id, tipo, forma, valor)
           values (%L, %L, 'final', 'credito', 50)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  '23514', null, 'Crédito exige número de parcelas');
select throws_ok(
  format($$insert into os_pagamentos (loja_id, os_id, tipo, forma, parcelas, valor)
           values (%L, %L, 'final', 'pix', 2, 50)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  '23514', null, 'Parcelas só no crédito');
select throws_ok(
  format($$insert into os_pagamentos (loja_id, os_id, tipo, forma, parcelas, valor)
           values (%L, %L, 'final', 'credito', 30, 50)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  '23514', null, 'No máximo 24 parcelas');
select throws_ok(
  format($$insert into os_pagamentos (loja_id, os_id, tipo, forma, valor)
           values (%L, %L, 'final', 'pix', 0)$$,
         (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_a')),
  '23514', null, 'Valor zero é recusado');
select is(
  (select sum(valor) from os_pagamentos),
  650.00::numeric, 'Atendente lê a soma dos pagamentos da OS');
select testes.sair();

-- Corrigir é do Dono (pagamentos_travas); mesmo ele não troca para forma inativa.
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select throws_ok(
  format($$update os_pagamentos set forma = 'dinheiro' where os_id = %L and forma = 'pix'$$,
         (select id from ids where chave = 'os_a')),
  'P0001', 'Esta forma de pagamento não está ativa na loja.',
  'Correção para forma inativa também é recusada');
select testes.sair();

-- Auditoria registrou as duas inclusões ---------------------------------
select is(
  (select count(*)::int from auditoria
    where tabela = 'os_pagamentos' and loja_id = (select id from ids where chave = 'loja_a')),
  2, 'Cada pagamento incluído fica na auditoria');

-- Outra loja -------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));
select is_empty(
  $$select id from os_pagamentos$$,
  'Dono B não lê pagamentos da loja A');
select testes.sair();

select * from finish();
rollback;
