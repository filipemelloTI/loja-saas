-- Fluxo do orçamento: enviar, aprovar, recusar, nova versão; travas do que
-- já foi enviado; concorrência; isolamento por loja.
begin;
select plan(31);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('atend_a', testes.criar_usuario('atend.a@teste.local')),
  ('dono_a',  testes.criar_usuario('dono.a@teste.local')),
  ('dono_b',  testes.criar_usuario('dono.b@teste.local'));

insert into planos (nome, modulos, limite_usuarios)
values ('TesteFluxo', '{servico}', 5);
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteFluxo'
  returning id)
insert into ids select 'loja_a', id from l;
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TesteFluxo'
  returning id)
insert into ids select 'loja_b', id from l;

insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),  'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'),  'Dono B', 'dono');

-- Três OS da loja A: principal (em análise), vazia (em análise), balcão (aberta).
insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado, observacao) values
  ((select id from ids where chave = 'loja_a'), true, 'celular', 'Tela', 'principal'),
  ((select id from ids where chave = 'loja_a'), true, 'celular', 'Nada', 'vazia'),
  ((select id from ids where chave = 'loja_a'), true, 'celular', 'Bateria', 'balcao');
insert into ids select 'os_p', id from ordens_servico where observacao = 'principal';
insert into ids select 'os_v', id from ordens_servico where observacao = 'vazia';
insert into ids select 'os_b', id from ordens_servico where observacao = 'balcao';
update ordens_servico set status = 'em_analise' where observacao in ('principal', 'vazia');

-- Atendente monta o orçamento ---------------------------------------------
select testes.entrar_como((select id from ids where chave = 'atend_a'));

select lives_ok(
  format($$insert into os_orcamentos (loja_id, os_id) values (%L, %L), (%L, %L), (%L, %L)$$,
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_p'),
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_v'),
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_b')),
  'Atendente cria orçamento em rascunho');
select lives_ok(
  format($$insert into os_orcamento_itens (orcamento_id, loja_id, descricao, preco_unitario)
           select o.id, %L, 'Troca de tela', 300 from os_orcamentos o where o.os_id in (%L, %L)$$,
    (select id from ids where chave = 'loja_a'),
    (select id from ids where chave = 'os_p'), (select id from ids where chave = 'os_b')),
  'Atendente lança itens no rascunho');
select lives_ok(
  format($$insert into os_pecas (loja_id, os_id, descricao, preco_unitario) values (%L, %L, 'Tela', 350)$$,
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_p')),
  'Peça entra enquanto o orçamento é rascunho');
select lives_ok(
  format($$update os_orcamentos set desconto_valor = 10 where os_id = %L$$,
    (select id from ids where chave = 'os_p')),
  'Desconto muda enquanto o orçamento é rascunho');
select throws_ok(
  format($$update os_orcamentos set status = 'aprovado' where os_id = %L$$,
    (select id from ids where chave = 'os_p')),
  '42501', null,
  'Atendente não aprova mudando o status direto');

-- Enviar --------------------------------------------------------------------
select throws_ok(
  format($$select enviar_orcamento_os((select id from os_orcamentos where os_id = %L))$$,
    (select id from ids where chave = 'os_v')),
  'P0001', 'O orçamento não tem itens.',
  'Orçamento sem itens não é enviado');
select throws_ok(
  format($$select enviar_orcamento_os((select id from os_orcamentos where os_id = %L))$$,
    (select id from ids where chave = 'os_b')),
  'P0001', 'Coloque a OS em análise antes de enviar o orçamento.',
  'OS ainda aberta não recebe orçamento enviado');
select lives_ok(
  format($$select enviar_orcamento_os((select id from os_orcamentos where os_id = %L))$$,
    (select id from ids where chave = 'os_p')),
  'Envia o orçamento da OS em análise');
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_p')),
  'orcamento_enviado', 'A OS passa para orçamento enviado');

-- Travas depois de enviado ----------------------------------------------
select throws_ok(
  format($$insert into os_orcamento_itens (orcamento_id, loja_id, descricao, preco_unitario)
           select id, %L, 'Extra', 50 from os_orcamentos where os_id = %L$$,
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_p')),
  'P0001', 'Este orçamento já foi enviado. Para alterar, crie uma nova versão.',
  'Item não entra em orçamento enviado');
select throws_ok(
  format($$update os_orcamentos set desconto_valor = 100 where os_id = %L$$,
    (select id from ids where chave = 'os_p')),
  'P0001', 'Este orçamento já foi enviado. Para alterar, crie uma nova versão.',
  'Desconto não muda em orçamento enviado');
select throws_ok(
  format($$insert into os_pecas (loja_id, os_id, descricao, preco_unitario) values (%L, %L, 'Cola', 20)$$,
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_p')),
  'P0001', 'O orçamento já foi enviado. Para mudar as peças, crie uma nova versão.',
  'Peça não entra depois do orçamento enviado');

-- Aprovar -----------------------------------------------------------------
select throws_ok(
  format($$select aprovar_orcamento_os((select id from os_orcamentos where os_id = %L), '  ', 'balcao')$$,
    (select id from ids where chave = 'os_p')),
  'P0001', 'Informe quem aprovou.',
  'Aprovação exige o nome de quem aprovou');
select throws_ok(
  format($$select aprovar_orcamento_os((select id from os_orcamentos where os_id = %L), 'Ana', 'email')$$,
    (select id from ids where chave = 'os_p')),
  'P0001', 'Informe como o cliente aprovou.',
  'Aprovação exige um meio conhecido');
select lives_ok(
  format($$select aprovar_orcamento_os((select id from os_orcamentos where os_id = %L), ' Ana ', 'telefone')$$,
    (select id from ids where chave = 'os_p')),
  'Atendente registra a aprovação por telefone');
select is(
  (select row(aprovado_por, aprovado_meio, aprovado_em is not null)::text
     from os_orcamentos where os_id = (select id from ids where chave = 'os_p')),
  '(Ana,telefone,t)', 'Aprovação guarda quem, como e quando');
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_p')),
  'aprovado', 'A OS passa para aprovado');
select throws_ok(
  format($$select aprovar_orcamento_os((select id from os_orcamentos where os_id = %L), 'Ana', 'balcao')$$,
    (select id from ids where chave = 'os_p')),
  'P0001', 'O orçamento mudou enquanto você olhava. Recarregue a tela e tente de novo.',
  'Segundo clique em Aprovar é recusado');

-- Atalho do balcão: OS aberta, aprova direto o rascunho ------------------
select lives_ok(
  format($$select aprovar_orcamento_os((select id from os_orcamentos where os_id = %L), 'Cliente', 'balcao')$$,
    (select id from ids where chave = 'os_b')),
  'No balcão, aprova o rascunho de uma OS aberta');
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_b')),
  'aprovado', 'OS do balcão vai direto para aprovado');

-- Nova versão -------------------------------------------------------------
select lives_ok(
  format($$select editar_orcamento_os((select id from os_orcamentos where os_id = %L and versao = 1))$$,
    (select id from ids where chave = 'os_p')),
  'Orçamento aprovado ganha nova versão');
select is(
  (select array_agg(status::text order by versao) from os_orcamentos
    where os_id = (select id from ids where chave = 'os_p')),
  array['substituido', 'rascunho'],
  'A versão 1 fica guardada e a 2 nasce em rascunho');
select is(
  (select row(count(*), max(o.desconto_valor))::text
     from os_orcamento_itens i join os_orcamentos o on o.id = i.orcamento_id
    where o.os_id = (select id from ids where chave = 'os_p') and o.versao = 2),
  '(1,10.00)', 'A versão 2 copia itens e desconto');
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_p')),
  'orcamento_enviado', 'A OS volta para orçamento enviado e pede nova aprovação');
select throws_ok(
  format($$select editar_orcamento_os((select id from os_orcamentos where os_id = %L and versao = 1))$$,
    (select id from ids where chave = 'os_p')),
  'P0001', 'O orçamento mudou enquanto você olhava. Recarregue a tela e tente de novo.',
  'Duas edições da mesma versão: a segunda é recusada');

-- Recusar ------------------------------------------------------------------
select lives_ok(
  format($$select enviar_orcamento_os((select id from os_orcamentos where os_id = %L and versao = 2));
           select recusar_orcamento_os((select id from os_orcamentos where os_id = %L and versao = 2))$$,
    (select id from ids where chave = 'os_p'), (select id from ids where chave = 'os_p')),
  'Envia e recusa a versão 2');
select is(
  (select status::text from ordens_servico where id = (select id from ids where chave = 'os_p')),
  'recusado', 'A OS passa para recusado');
select testes.sair();

-- Histórico registrou a volta da aprovação --------------------------------
select is(
  (select count(*)::int from os_historico
    where os_id = (select id from ids where chave = 'os_p')
      and de_status = 'aprovado' and para_status = 'orcamento_enviado'
      and observacao like 'Orçamento alterado (versão 2)%'),
  1, 'O histórico explica por que a OS voltou');

-- Outra loja ---------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));
select throws_ok(
  format($$select editar_orcamento_os(%L)$$,
    (select id from os_orcamentos where os_id = (select id from ids where chave = 'os_b'))),
  'P0001', 'Orçamento não encontrado',
  'Dono B não mexe no orçamento da loja A');
select throws_ok(
  format($$insert into os_orcamento_itens (orcamento_id, loja_id, descricao, preco_unitario)
           values (%L, %L, 'Intruso', 1)$$,
    (select id from os_orcamentos where os_id = (select id from ids where chave = 'os_v')),
    (select id from ids where chave = 'loja_b')),
  'P0001', null,
  'Dono B não pendura item no orçamento da loja A');
select testes.sair();

-- Mesmo sem as travas de usuário, o vínculo composto exige a mesma loja.
select throws_ok(
  format($$insert into os_orcamento_itens (orcamento_id, loja_id, descricao, preco_unitario)
           values (%L, %L, 'Intruso', 1)$$,
    (select id from os_orcamentos where os_id = (select id from ids where chave = 'os_v')),
    (select id from ids where chave = 'loja_b')),
  '23503', null,
  'Item só se liga a orçamento da mesma loja');

select * from finish();
rollback;
