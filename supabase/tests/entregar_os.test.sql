-- Entrega da OS: bloqueios (etapa, orçamento, custo pendente, pagamento),
-- números congelados no exemplo da spec, Dono como técnico, OS interna,
-- concorrência e isolamento por loja.
begin;
select plan(20);

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
values ('TesteEntrega', '{servico}', 5);
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteEntrega'
  returning id)
insert into ids select 'loja_a', id from l;
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TesteEntrega'
  returning id)
insert into ids select 'loja_b', id from l;

insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),  'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'tec_a'),   'Tec A', 'tecnico'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'),  'Dono B', 'dono');
insert into ids select 'm_tec', id from membros where nome = 'Tec A';
insert into ids select 'm_dono', id from membros where nome = 'Dono A';

-- Técnico a 30%; o Dono também tem % cadastrada, mas a loja não paga comissão ao Dono.
insert into comissoes_membro (membro_id, loja_id, percentual) values
  ((select id from ids where chave = 'm_tec'),  (select id from ids where chave = 'loja_a'), 30),
  ((select id from ids where chave = 'm_dono'), (select id from ids where chave = 'loja_a'), 20);

insert into clientes (loja_id, nome, telefone)
values ((select id from ids where chave = 'loja_a'), 'Maria', '11999990000');
insert into ids select 'cli', id from clientes where nome = 'Maria';

-- OS da loja A:
--   spec    pronta, técnico 30%, serviço 300 + peça 350 (custo 280) = 650
--   dono    pronta, Dono como técnico, serviço 100 com 10% de desconto = 90
--   cedo    em serviço
--   semorc  pronta, sem orçamento
--   interna pronta, OS interna sem orçamento
insert into ordens_servico (loja_id, cliente_id, interna, aparelho_tipo, defeito_relatado, observacao, tecnico_id) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'cli'), false, 'celular', 'Tela',    'spec',    (select id from ids where chave = 'm_tec')),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'cli'), false, 'celular', 'Bateria', 'dono',    (select id from ids where chave = 'm_dono')),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'cli'), false, 'celular', 'Botão',   'cedo',    null),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'cli'), false, 'celular', 'Som',     'semorc',  null),
  ((select id from ids where chave = 'loja_a'), null,                                     true,  'celular', 'Revisão', 'interna', null);
insert into ids select 'os_' || observacao, id from ordens_servico
  where observacao in ('spec', 'dono', 'cedo', 'semorc', 'interna');

insert into os_orcamentos (loja_id, os_id, status, desconto_percentual, aprovado_por, aprovado_meio, aprovado_em) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_spec'), 'aprovado', null, 'Maria', 'balcao', now()),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_dono'), 'aprovado', 10,   'Maria', 'balcao', now());
insert into os_orcamento_itens (orcamento_id, loja_id, descricao, preco_unitario)
  select o.id, o.loja_id, 'Mão de obra', case o.os_id when (select id from ids where chave = 'os_spec') then 300 else 100 end
    from os_orcamentos o;
insert into os_pecas (loja_id, os_id, descricao, preco_unitario)
values ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_spec'), 'Tela', 350);

update ordens_servico set status = 'pronto' where observacao in ('spec', 'dono', 'semorc', 'interna');
update ordens_servico set status = 'em_servico' where observacao = 'cedo';

insert into os_pagamentos (loja_id, os_id, tipo, forma, valor) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_spec'), 'sinal', 'pix', 300),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_dono'), 'final', 'pix', 90);

-- Bloqueios -----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'atend_a'));

select throws_ok(
  format($$select mudar_status_os(%L, 'pronto', 'entregue')$$, (select id from ids where chave = 'os_spec')),
  'P0001', 'Use o botão Entregar para encerrar a OS.',
  'O botão de etapa não entrega a OS');
select throws_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_cedo')),
  'P0001', 'A OS só pode ser entregue quando estiver pronta.',
  'OS ainda em serviço não é entregue');
select throws_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_semorc')),
  'P0001', 'A OS não tem orçamento aprovado.',
  'OS de cliente sem orçamento aprovado não é entregue');
select throws_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_spec')),
  'P0001', 'O Dono precisa preencher o custo de todas as peças antes da entrega.',
  'Peça com custo pendente barra a entrega');
select testes.sair();

insert into os_pecas_custo (peca_id, loja_id, custo_unitario)
  select id, loja_id, 280 from os_pecas where os_id = (select id from ids where chave = 'os_spec');

select testes.entrar_como((select id from ids where chave = 'atend_a'));
select throws_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_spec')),
  'P0001', 'Falta receber R$ 350,00 antes de entregar.',
  'Pagamento incompleto barra a entrega e diz quanto falta');
select testes.sair();

insert into os_pagamentos (loja_id, os_id, tipo, forma, parcelas, valor) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_spec'), 'final', 'credito', 2, 400);

select testes.entrar_como((select id from ids where chave = 'atend_a'));
select throws_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_spec')),
  'P0001', 'Os pagamentos passam do total da OS. Corrija antes de entregar.',
  'Pagamento acima do total barra a entrega');
select testes.sair();

update os_pagamentos set valor = 350
 where forma = 'credito' and os_id = (select id from ids where chave = 'os_spec');

-- Entrega do exemplo da spec ---------------------------------------------
select testes.entrar_como((select id from ids where chave = 'atend_a'));
select lives_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_spec')),
  'Atendente entrega a OS sem ver o custo');
select throws_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_spec')),
  'P0001', 'A OS já foi encerrada.',
  'Segundo clique em Entregar é recusado');
select testes.sair();

select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_spec')),
  'entregue', 'A OS fica entregue');
select is(
  (select row(total, custo_pecas, comissao_percentual,
              comissao, lucro)::text
     from os_fechamento where os_id = (select id from ids where chave = 'os_spec')),
  '(650.00,280.00,30.00,111.00,259.00)',
  'Spec 8.5: cobrado 650, peça 280, 30% → comissão 111, sobrou 259');
select is(
  (select tecnico_id from os_fechamento where os_id = (select id from ids where chave = 'os_spec')),
  (select id from ids where chave = 'm_tec'), 'O técnico da entrega fica gravado');
select isnt(
  (select encerrada_em from ordens_servico where id = (select id from ids where chave = 'os_spec')),
  null, 'A entrega carimba encerrada_em');
select is(
  (select count(*)::int from os_historico
    where os_id = (select id from ids where chave = 'os_spec')
      and de_status = 'pronto' and para_status = 'entregue'),
  1, 'A entrega entra no histórico uma vez');

-- Mudar a % depois não mexe na OS entregue.
update comissoes_membro set percentual = 50 where membro_id = (select id from ids where chave = 'm_tec');
select is(
  (select comissao from os_fechamento where os_id = (select id from ids where chave = 'os_spec')),
  111.00::numeric, 'Mudar a % depois não altera a comissão congelada');

-- Dono como técnico, com desconto -----------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select lives_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_dono')),
  'Dono entrega a OS em que ele foi o técnico');
select testes.sair();
select is(
  (select row(total, custo_pecas, comissao_percentual,
              comissao, lucro)::text
     from os_fechamento where os_id = (select id from ids where chave = 'os_dono')),
  '(90.00,0.00,0.00,0.00,90.00)',
  'Desconto de 10% aplicado; Dono como técnico não gera comissão');

-- OS interna, sem orçamento -----------------------------------------------
select testes.entrar_como((select id from ids where chave = 'tec_a'));
select lives_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_interna')),
  'OS interna é encerrada sem orçamento nem pagamento');
select testes.sair();
select is(
  (select row(total, comissao, lucro)::text
     from os_fechamento where os_id = (select id from ids where chave = 'os_interna')),
  '(0.00,0.00,0.00)', 'OS interna congela tudo em zero');

-- Outra loja ---------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));
select throws_ok(
  format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_semorc')),
  'P0001', 'OS não encontrada',
  'Dono B não entrega OS da loja A');
select testes.sair();
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_semorc')),
  'pronto', 'A OS da loja A segue pronta');

select * from finish();
rollback;
