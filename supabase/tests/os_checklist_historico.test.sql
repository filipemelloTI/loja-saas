begin;
select plan(32);

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
insert into ids select 'membro_b', id from membros where user_id = (select id from ids where chave = 'dono_b');

insert into admins_plataforma (user_id) select id from ids where chave = 'admin';

-- Três OS: duas na loja A (a segunda será apagada no teste de cascata), uma na B.
with o as (
  insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
  values ((select id from ids where chave = 'loja_a'), true, 'celular', 'OS A1')
  returning id)
insert into ids select 'os_a1', id from o;
with o as (
  insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
  values ((select id from ids where chave = 'loja_a'), true, 'celular', 'OS A2')
  returning id)
insert into ids select 'os_a2', id from o;
with o as (
  insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
  values ((select id from ids where chave = 'loja_b'), true, 'celular', 'OS B1')
  returning id)
insert into ids select 'os_b1', id from o;

-- Item de origem na lista editável da loja A
with c as (
  insert into checklist_itens (loja_id, nome)
  values ((select id from ids where chave = 'loja_a'), 'Item Efêmero')
  returning id)
insert into ids select 'item_a', id from c;

-- Checklist registrado no balcão (cópia do texto, não referência)
insert into os_checklist (os_id, loja_id, nome, marcado, observacao) values
  ((select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a'),
   'Item Efêmero', true, 'Já estava assim'),
  ((select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a'),
   'Tela trincada', true, null),
  ((select id from ids where chave = 'os_a2'), (select id from ids where chave = 'loja_a'),
   'Câmera', false, null),
  ((select id from ids where chave = 'os_b1'), (select id from ids where chave = 'loja_b'),
   'Carga B', true, null);

insert into os_historico (os_id, loja_id, de_status, para_status, membro_id) values
  ((select id from ids where chave = 'os_a2'), (select id from ids where chave = 'loja_a'),
   'aberta', 'em_analise', (select id from ids where chave = 'membro_a'));

select ok(
  (select relrowsecurity from pg_class where oid = 'public.os_checklist'::regclass),
  'os_checklist tem RLS habilitada');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.os_historico'::regclass),
  'os_historico tem RLS habilitada');

-- O checklist é uma fotografia -------------------------------------------
update checklist_itens set nome = 'Renomeado'
where id = (select id from ids where chave = 'item_a');
select is(
  (select nome from checklist_itens where id = (select id from ids where chave = 'item_a')),
  'Renomeado', 'Item de origem foi renomeado na lista da loja');
select is(
  (select nome from os_checklist
   where os_id = (select id from ids where chave = 'os_a1') and observacao = 'Já estava assim'),
  'Item Efêmero', 'Renomear o item de origem não altera o texto registrado na OS');

delete from checklist_itens where id = (select id from ids where chave = 'item_a');
select is_empty(
  $$select 1 from checklist_itens where nome in ('Item Efêmero', 'Renomeado')$$,
  'Item de origem foi apagado da lista da loja');
select results_eq(
  format($$select nome, marcado, observacao from os_checklist
           where os_id = %L and observacao = 'Já estava assim'$$,
         (select id from ids where chave = 'os_a1')),
  $$values ('Item Efêmero'::text, true, 'Já estava assim'::text)$$,
  'Apagar o item de origem mantém a linha da OS exatamente como registrada');

-- Cascata ----------------------------------------------------------------
select is(
  (select count(*) from os_checklist where os_id = (select id from ids where chave = 'os_a2')),
  1::bigint, 'Antes de apagar, a OS A2 tem 1 linha de checklist');
select is(
  (select count(*) from os_historico where os_id = (select id from ids where chave = 'os_a2')),
  1::bigint, 'Antes de apagar, a OS A2 tem 1 linha de histórico');
delete from ordens_servico where id = (select id from ids where chave = 'os_a2');
select is(
  (select count(*) from os_checklist where os_id = (select id from ids where chave = 'os_a2')),
  0::bigint, 'Apagar a OS leva junto o checklist');
select is(
  (select count(*) from os_historico where os_id = (select id from ids where chave = 'os_a2')),
  0::bigint, 'Apagar a OS leva junto o histórico');

-- Dono A -----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));

select is(
  (select array_agg(nome order by nome) from os_checklist),
  array['Item Efêmero', 'Tela trincada'], 'Dono A lê apenas o checklist da loja A');
select lives_ok(
  format($$insert into os_checklist (os_id, loja_id, nome, marcado)
           values (%L, %L, 'Botões', false)$$,
         (select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a')),
  'Dono A registra item de checklist na OS da própria loja');
select results_eq(
  $$update os_checklist set marcado = true where nome = 'Botões' returning marcado$$,
  array[true], 'Dono A atualiza item de checklist da própria loja');
select lives_ok(
  format($$insert into os_historico (os_id, loja_id, de_status, para_status, membro_id)
           values (%L, %L, 'aberta', 'em_analise', %L)$$,
         (select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a'),
         (select id from ids where chave = 'membro_a')),
  'Dono A grava histórico de status na própria loja');
select is(
  (select para_status::text from os_historico), 'em_analise',
  'Dono A lê o histórico da própria loja');

select throws_ok(
  $$update os_historico set para_status = 'entregue'$$,
  '42501', null, 'Histórico não aceita update, nem do dono');
select throws_ok(
  $$delete from os_historico$$,
  '42501', null, 'Histórico não aceita delete, nem do dono');
select is(
  (select para_status::text || ':' || count(*) over () from os_historico),
  'em_analise:1', 'Histórico segue intacto após as tentativas de update e delete');
select throws_ok(
  format($$insert into os_historico (os_id, loja_id, de_status, para_status, membro_id)
           values (%L, %L, 'em_analise', 'pronto', %L)$$,
         (select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a'),
         (select id from ids where chave = 'membro_b')),
  '23503', null, 'Histórico não aceita membro de outra loja');

-- Dono B -----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));

select is(
  (select array_agg(nome) from os_checklist),
  array['Carga B'], 'Dono B lê apenas o checklist da loja B');
select is_empty(
  $$select 1 from os_historico$$, 'Dono B não vê o histórico da loja A');
select throws_ok(
  format($$insert into os_checklist (os_id, loja_id, nome, marcado)
           values (%L, %L, 'Intruso', true)$$,
         (select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a')),
  '42501', null, 'Dono B não insere checklist na loja A');
select throws_ok(
  format($$insert into os_checklist (os_id, loja_id, nome, marcado)
           values (%L, %L, 'Intruso', true)$$,
         (select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_b')),
  '23503', null, 'Dono B não pendura checklist na OS da loja A usando a própria loja');
select is_empty(
  $$update os_checklist set marcado = false where nome in ('Tela trincada', 'Botões', 'Item Efêmero') returning id$$,
  'Dono B não atualiza checklist da loja A');
select is_empty(
  $$delete from os_checklist where nome in ('Tela trincada', 'Botões', 'Item Efêmero') returning id$$,
  'Dono B não apaga checklist da loja A');
select throws_ok(
  format($$insert into os_historico (os_id, loja_id, de_status, para_status)
           values (%L, %L, 'aberta', 'pronto')$$,
         (select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a')),
  '42501', null, 'Dono B não insere histórico na loja A');

select testes.sair();
select is(
  (select array_agg(nome || ':' || marcado order by nome) from os_checklist
   where os_id = (select id from ids where chave = 'os_a1')),
  array['Botões:true', 'Item Efêmero:true', 'Tela trincada:true'],
  'Checklist da loja A segue intacto após as tentativas do Dono B');
select is(
  (select count(*) from os_historico where os_id = (select id from ids where chave = 'os_a1')),
  1::bigint, 'Histórico da loja A segue com 1 linha após as tentativas do Dono B');

-- Admin em suporte -------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
insert into acessos_suporte (loja_id, expira_em)
values ((select id from ids where chave = 'loja_a'), now() + interval '24 hours');

select testes.entrar_como((select id from ids where chave = 'admin'));
select is(
  (select count(*) from os_checklist), 3::bigint,
  'Admin em suporte lê o checklist da loja A (e só dela)');
select is(
  (select count(*) from os_historico), 1::bigint,
  'Admin em suporte lê o histórico da loja A');
select throws_ok(
  format($$insert into os_checklist (os_id, loja_id, nome, marcado)
           values (%L, %L, 'Suporte', true)$$,
         (select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a')),
  '42501', null, 'Admin em suporte não insere checklist');
select throws_ok(
  format($$insert into os_historico (os_id, loja_id, de_status, para_status)
           values (%L, %L, 'aberta', 'pronto')$$,
         (select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a')),
  '42501', null, 'Admin em suporte não insere histórico');

select * from finish();
rollback;
