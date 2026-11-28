-- Garantia: três fontes de prazo, só o Dono ajusta, entrega congela, OS de
-- garantia sem cobrança, vencida recusa, link público mostra.
begin;
select plan(16);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated, anon;

insert into ids values
  ('dono_a',  testes.criar_usuario('dono.a@teste.local')),
  ('atend_a', testes.criar_usuario('atend.a@teste.local')),
  ('dono_b',  testes.criar_usuario('dono.b@teste.local'));

insert into planos (nome, modulos, limite_usuarios) values ('TesteGar', '{servico}', 5);
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteGar' returning id)
insert into ids select 'loja_a', id from l;
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TesteGar' returning id)
insert into ids select 'loja_b', id from l;
insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),  'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'),  'Dono B', 'dono');

insert into servicos (loja_id, nome, preco, garantia_dias) values
  ((select id from ids where chave = 'loja_a'), 'Troca de tela', 300, 180);
insert into ids select 'srv_tela', id from servicos where nome = 'Troca de tela'
  and loja_id = (select id from ids where chave = 'loja_a');
insert into clientes (loja_id, nome, telefone) values
  ((select id from ids where chave = 'loja_a'), 'Maria', '13999990000');

-- Duas OS de cliente, prontas e pagas: "tela" (serviço de 180 dias) e "avulsa" (sem catálogo).
insert into ordens_servico (loja_id, cliente_id, aparelho_tipo, defeito_relatado, observacao) values
  ((select id from ids where chave = 'loja_a'), (select id from clientes where nome = 'Maria'), 'celular', 'Tela', 'tela'),
  ((select id from ids where chave = 'loja_a'), (select id from clientes where nome = 'Maria'), 'celular', 'Som', 'avulsa');
insert into ids select 'os_' || observacao, id from ordens_servico where observacao in ('tela', 'avulsa');
insert into os_orcamentos (loja_id, os_id, status, aprovado_por, aprovado_meio, aprovado_em)
  select loja_id, id, 'aprovado', 'Maria', 'balcao', now() from ordens_servico where observacao in ('tela', 'avulsa');
insert into os_orcamento_itens (orcamento_id, loja_id, descricao, preco_unitario, servico_id)
  select o.id, o.loja_id, 'Item', 300,
         case s.observacao when 'tela' then (select id from ids where chave = 'srv_tela') end
    from os_orcamentos o join ordens_servico s on s.id = o.os_id where s.observacao in ('tela', 'avulsa');
insert into os_pagamentos (loja_id, os_id, tipo, forma, valor)
  select loja_id, id, 'final', 'pix', 300 from ordens_servico where observacao in ('tela', 'avulsa');
update ordens_servico set status = 'pronto' where observacao in ('tela', 'avulsa');

-- Prazo previsto ---------------------------------------------------------------
select is(garantia_prevista_os((select id from ids where chave = 'os_tela')), 180,
  'Serviço do catálogo com prazo próprio: 180 dias');
select is(garantia_prevista_os((select id from ids where chave = 'os_avulsa')), 90,
  'Sem serviço do catálogo: prazo padrão da loja (90)');

select testes.entrar_como((select id from ids where chave = 'atend_a'));
select throws_ok(
  format($$update ordens_servico set garantia_ajuste_dias = 30 where id = %L$$, (select id from ids where chave = 'os_avulsa')),
  'P0001', 'Só o Dono ajusta o prazo de garantia.', 'Atendente não ajusta o prazo');
select throws_ok(
  format($$update ordens_servico set garantia_dias = 999 where id = %L$$, (select id from ids where chave = 'os_avulsa')),
  '42501', null, 'Ninguém grava o prazo congelado à mão');
select throws_ok(
  format($$insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado, garantia_de)
           values (%L, true, 'celular', 'x', %L)$$,
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_tela')),
  '42501', null, 'Não se abre OS de garantia por fora da função');
select testes.sair();

select testes.entrar_como((select id from ids where chave = 'dono_a'));
select lives_ok(
  format($$update ordens_servico set garantia_ajuste_dias = 30 where id = %L$$, (select id from ids where chave = 'os_avulsa')),
  'Dono ajusta o prazo antes da entrega');
select is(garantia_prevista_os((select id from ids where chave = 'os_avulsa')), 30, 'O ajuste do Dono vale primeiro');
select testes.sair();

-- Entrega congela ----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'atend_a'));
select lives_ok(format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_tela')), 'Entrega a OS da tela');
select testes.sair();
select is((select garantia_dias from ordens_servico where id = (select id from ids where chave = 'os_tela')), 180,
  'A entrega congela 180 dias');

-- OS de garantia -----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'atend_a'));
select throws_ok(
  format($$select abrir_os_garantia(%L, 'Voltou')$$, (select id from ids where chave = 'os_avulsa')),
  'P0001', 'Só dá para abrir garantia de OS entregue com garantia.', 'OS ainda não entregue não abre garantia');
select lives_ok(
  format($$select abrir_os_garantia(%L, 'Tela voltou a piscar')$$, (select id from ids where chave = 'os_tela')),
  'Abre OS de garantia dentro do prazo');
select testes.sair();

insert into ids select 'os_gar', id from ordens_servico where garantia_de = (select id from ids where chave = 'os_tela');
select is(
  (select row(cliente_id = (select id from clientes where nome = 'Maria'), observacao)::text
     from ordens_servico where id = (select id from ids where chave = 'os_gar')),
  format('(t,"Garantia da OS nº %s")', (select numero from ordens_servico where id = (select id from ids where chave = 'os_tela'))),
  'A OS de garantia é do mesmo cliente e aponta a original');

update ordens_servico set status = 'pronto' where id = (select id from ids where chave = 'os_gar');
select testes.entrar_como((select id from ids where chave = 'atend_a'));
select lives_ok(format($$select entregar_os(%L)$$, (select id from ids where chave = 'os_gar')),
  'OS de garantia é entregue sem orçamento nem pagamento');
select testes.sair();
select is(
  (select row(f.total, f.comissao, o.garantia_dias is null)::text
     from os_fechamento f join ordens_servico o on o.id = f.os_id where f.os_id = (select id from ids where chave = 'os_gar')),
  '(0.00,0.00,t)', 'Na garantia: total zero, comissão zero e nenhuma garantia nova');

-- Vencida ----------------------------------------------------------------------
update ordens_servico set encerrada_em = now() - interval '200 days' where id = (select id from ids where chave = 'os_tela');
select testes.entrar_como((select id from ids where chave = 'atend_a'));
select throws_like(
  format($$select abrir_os_garantia(%L, 'De novo')$$, (select id from ids where chave = 'os_tela')),
  'A garantia desta OS venceu em %', 'Garantia vencida não abre OS de garantia');
select testes.sair();

-- Link público mostra a garantia ----------------------------------------------
update ordens_servico set encerrada_em = now() where id = (select id from ids where chave = 'os_tela');
select is(
  (select (acompanhamento_os(token_publico) -> 'garantia' ->> 'dias')
     from ordens_servico where id = (select id from ids where chave = 'os_tela')),
  '180', 'O link do cliente mostra a garantia');

select * from finish();
rollback;
