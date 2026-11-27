-- Travas de pagamento: só o Dono apaga ou corrige; OS encerrada não mexe.
begin;
select plan(6);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('dono_a',  testes.criar_usuario('dono.a@teste.local')),
  ('atend_a', testes.criar_usuario('atend.a@teste.local'));

insert into planos (nome, modulos, limite_usuarios) values ('TesteTravaPag', '{servico}', 5);
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteTravaPag' returning id)
insert into ids select 'loja_a', id from l;
insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),  'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente');

insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado, observacao) values
  ((select id from ids where chave = 'loja_a'), true, 'celular', 'Tela', 'aberta'),
  ((select id from ids where chave = 'loja_a'), true, 'celular', 'Som',  'fechada');
insert into ids select 'os_' || observacao, id from ordens_servico where observacao in ('aberta', 'fechada');

insert into os_pagamentos (loja_id, os_id, tipo, forma, valor) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_aberta'),  'sinal', 'pix', 100),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_fechada'), 'final', 'pix', 50);
update ordens_servico set status = 'entregue' where observacao = 'fechada';

select testes.entrar_como((select id from ids where chave = 'atend_a'));
select throws_ok(
  format($$delete from os_pagamentos where os_id = %L$$, (select id from ids where chave = 'os_aberta')),
  'P0001', 'Só o Dono corrige um pagamento já lançado.',
  'Atendente não apaga pagamento');
select throws_ok(
  format($$update os_pagamentos set valor = 1 where os_id = %L$$, (select id from ids where chave = 'os_aberta')),
  'P0001', 'Só o Dono corrige um pagamento já lançado.',
  'Atendente não corrige pagamento');
select throws_ok(
  format($$insert into os_pagamentos (loja_id, os_id, tipo, forma, valor) values (%L, %L, 'final', 'pix', 10)$$,
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_fechada')),
  'P0001', 'A OS já foi encerrada.',
  'OS encerrada não recebe pagamento');
select testes.sair();

select testes.entrar_como((select id from ids where chave = 'dono_a'));
select throws_ok(
  format($$delete from os_pagamentos where os_id = %L$$, (select id from ids where chave = 'os_fechada')),
  'P0001', 'A OS já foi encerrada.',
  'Nem o Dono apaga pagamento de OS encerrada');
select lives_ok(
  format($$delete from os_pagamentos where os_id = %L$$, (select id from ids where chave = 'os_aberta')),
  'Dono apaga pagamento de OS aberta');
select testes.sair();

select is(
  (select count(*)::int from os_pagamentos where os_id = (select id from ids where chave = 'os_fechada')),
  1, 'O pagamento da OS encerrada segue lá');

select * from finish();
rollback;
