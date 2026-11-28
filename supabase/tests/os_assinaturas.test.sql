-- Assinaturas: entrada com a OS aberta, entrega só com a OS pronta, nada
-- muda depois de encerrada, isolamento por loja.
begin;
select plan(6);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('atend_a', testes.criar_usuario('atend.a@teste.local')),
  ('dono_b',  testes.criar_usuario('dono.b@teste.local'));
insert into planos (nome, modulos, limite_usuarios) values ('TesteAss', '{servico}', 5);
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteAss' returning id)
insert into ids select 'loja_a', id from l;
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TesteAss' returning id)
insert into ids select 'loja_b', id from l;
insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'), 'Dono B', 'dono');
insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'), true, 'celular', 'Tela');
insert into ids select 'os_a', id from ordens_servico where loja_id = (select id from ids where chave = 'loja_a');

create temp table cam (m text, c text) on commit drop;
grant select on cam to authenticated;
insert into cam select m, (select id from ids where chave = 'loja_a') || '/' || (select id from ids where chave = 'os_a') || '/assinatura-' || m || '.png'
  from unnest(array['entrada', 'entrega']) m;

select testes.entrar_como((select id from ids where chave = 'atend_a'));
select lives_ok(
  format($$insert into os_assinaturas (os_id, loja_id, momento, caminho) select %L, %L, 'entrada', c from cam where m = 'entrada'$$,
    (select id from ids where chave = 'os_a'), (select id from ids where chave = 'loja_a')),
  'Cliente assina na entrada');
select throws_ok(
  format($$insert into os_assinaturas (os_id, loja_id, momento, caminho) select %L, %L, 'entrega', c from cam where m = 'entrega'$$,
    (select id from ids where chave = 'os_a'), (select id from ids where chave = 'loja_a')),
  'P0001', 'A assinatura de entrega é feita com a OS pronta.', 'Entrega só com a OS pronta');
select testes.sair();

update ordens_servico set status = 'pronto' where id = (select id from ids where chave = 'os_a');
select testes.entrar_como((select id from ids where chave = 'atend_a'));
select lives_ok(
  format($$insert into os_assinaturas (os_id, loja_id, momento, caminho) select %L, %L, 'entrega', c from cam where m = 'entrega'$$,
    (select id from ids where chave = 'os_a'), (select id from ids where chave = 'loja_a')),
  'Com a OS pronta, cliente assina a entrega');
select testes.sair();

update ordens_servico set status = 'entregue' where id = (select id from ids where chave = 'os_a');
select testes.entrar_como((select id from ids where chave = 'atend_a'));
select throws_ok(
  format($$delete from os_assinaturas where os_id = %L$$, (select id from ids where chave = 'os_a')),
  'P0001', 'A OS já foi encerrada.', 'Depois de encerrada, a assinatura não muda');
select testes.sair();

select testes.entrar_como((select id from ids where chave = 'dono_b'));
select is_empty($$select os_id from os_assinaturas$$, 'Outra loja não vê as assinaturas');
select testes.sair();

select is((select count(*)::int from os_assinaturas where os_id = (select id from ids where chave = 'os_a')), 2,
  'Entrada e entrega guardadas');

select * from finish();
rollback;
