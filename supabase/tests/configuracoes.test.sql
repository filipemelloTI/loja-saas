begin;
select plan(21);

-- Só nesta transação (rollback no fim): permite trocar de usuário
-- estando já no papel authenticated.
grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated;

insert into ids values
  ('dono',      testes.criar_usuario('dono.c@teste.local')),
  ('tecnico',   testes.criar_usuario('tecnico.c@teste.local')),
  ('atendente', testes.criar_usuario('atendente.c@teste.local')),
  ('extra',     testes.criar_usuario('extra.c@teste.local')),
  ('admin',     testes.criar_usuario('admin.c@teste.local'));

insert into planos (nome, modulos, limite_usuarios)
values ('Teste Config', '{servico}', 3);
insert into admins_plataforma (user_id) select id from ids where chave = 'admin';

-- O admin da plataforma cria a loja: os padrões são semeados pelo trigger.
select testes.entrar_como((select id from ids where chave = 'admin'));
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja Config', id, '{servico}' from planos where nome = 'Teste Config'
  returning id)
insert into ids select 'loja', id from l;
select testes.sair();

insert into membros (loja_id, user_id, nome, perfil)
select (select id from ids where chave = 'loja'), u.id, u.nome, u.perfil::perfil
from (values
  ((select id from ids where chave = 'dono'),      'Dono',      'dono'),
  ((select id from ids where chave = 'tecnico'),   'Técnico',   'tecnico'),
  ((select id from ids where chave = 'atendente'), 'Atendente', 'atendente')
) as u (id, nome, perfil);

-- Dono -------------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono'));

select is((select count(*) from config_loja), 1::bigint,
  'Nova loja tem config_loja');
select is((select count(*) from checklist_itens), 9::bigint,
  'Nova loja tem 9 itens de checklist');
select is((select count(*) from condicoes_garantia), 4::bigint,
  'Nova loja tem 4 condições que anulam a garantia');
select is((select count(*) from mensagens_padrao), 7::bigint,
  'Nova loja tem 7 mensagens padrão');
select results_eq(
  'select orcamento_alerta_dias, os_numero_inicial from config_loja',
  $$values (3, 1)$$,
  'Padrões: alerta de orçamento em 3 dias, OS começa em 1');

with s as (
  insert into servicos (loja_id, nome, preco)
  values ((select id from ids where chave = 'loja'), 'Troca de tela', 300)
  returning id, loja_id)
insert into servicos_custo (servico_id, loja_id, custo_peca_estimado)
select id, loja_id, 120 from s;

insert into comissoes_membro (membro_id, loja_id, percentual)
select id, loja_id, 30 from membros
where user_id = (select id from ids where chave = 'tecnico');

select isnt_empty('select * from servicos_custo', 'Dono lê servicos_custo');
select isnt_empty('select * from comissoes_membro', 'Dono lê comissoes_membro');

select throws_ok(
  $$update comissoes_membro set percentual = 101$$,
  '23514', null,
  'Comissão acima de 100% é rejeitada');
select throws_ok(
  format($$insert into servicos (loja_id, nome, preco) values (%L, 'x', -1)$$,
         (select id from ids where chave = 'loja')),
  '23514', null,
  'Preço negativo é rejeitado');

select results_eq(
  'update config_loja set orcamento_alerta_dias = 5 returning orcamento_alerta_dias',
  $$values (5)$$,
  'Dono altera config_loja');

-- Técnico ----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'tecnico'));

select is_empty('select * from servicos_custo', 'Técnico não lê servicos_custo');
select is_empty('select * from comissoes_membro', 'Técnico não lê comissoes_membro');
select isnt_empty('select * from servicos', 'Técnico lê servicos');
select is_empty(
  'update config_loja set orcamento_alerta_dias = 10 returning loja_id',
  'Técnico não altera config_loja');

-- Atendente --------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'atendente'));

select is_empty('select * from servicos_custo', 'Atendente não lê servicos_custo');
select is_empty('select * from comissoes_membro', 'Atendente não lê comissoes_membro');

-- Limite de usuários e último dono ---------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono'));
update membros set ativo = false
where user_id = (select id from ids where chave = 'atendente');

select testes.sair();
update planos set limite_usuarios = 2 where nome = 'Teste Config';

-- Membro novo só entra pelo servidor (service role); o limite vale para ele também.
select throws_ok(
  format($$insert into membros (loja_id, user_id, nome, perfil)
           values (%L, %L, 'Extra', 'atendente')$$,
         (select id from ids where chave = 'loja'),
         (select id from ids where chave = 'extra')),
  'P0001', 'Limite de usuários do plano atingido',
  'Com 2 ativos e limite 2, não entra o 3º membro');

select testes.entrar_como((select id from ids where chave = 'dono'));
select throws_ok(
  format($$update membros set ativo = true where user_id = %L$$,
         (select id from ids where chave = 'atendente')),
  'P0001', 'Limite de usuários do plano atingido',
  'Com 2 ativos e limite 2, não reativa um inativo');
select throws_ok(
  format($$update membros set ativo = false where user_id = %L$$,
         (select id from ids where chave = 'dono')),
  'P0001', 'A loja precisa de pelo menos um dono ativo',
  'Não desativa o único dono');

-- Admin em suporte: lê o custo como Dono, mas não escreve -----------------
insert into acessos_suporte (loja_id, expira_em)
values ((select id from ids where chave = 'loja'), now() + interval '24 hours');

select testes.entrar_como((select id from ids where chave = 'admin'));

select isnt_empty('select * from servicos_custo', 'Admin em suporte lê servicos_custo');
select is_empty(
  'update servicos_custo set custo_peca_estimado = 1 returning servico_id',
  'Admin em suporte não altera servicos_custo');

select * from finish();
rollback;
