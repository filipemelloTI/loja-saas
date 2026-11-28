-- Fotos da OS: pasta da própria loja e OS, até 8 por momento, não apaga de
-- OS encerrada, isolamento por loja (tabela e arquivos).
begin;
select plan(9);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('atend_a', testes.criar_usuario('atend.a@teste.local')),
  ('dono_b',  testes.criar_usuario('dono.b@teste.local'));
insert into planos (nome, modulos, limite_usuarios) values ('TesteFotos', '{servico}', 5);
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteFotos' returning id)
insert into ids select 'loja_a', id from l;
with l as (insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TesteFotos' returning id)
insert into ids select 'loja_b', id from l;
insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'), 'Dono B', 'dono');
insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado, observacao) values
  ((select id from ids where chave = 'loja_a'), true, 'celular', 'Tela', 'aberta'),
  ((select id from ids where chave = 'loja_a'), true, 'celular', 'Som', 'fechada');
insert into ids select 'os_' || observacao, id from ordens_servico where observacao in ('aberta', 'fechada');

create temp table cam (n int, c text) on commit drop;
grant select on cam to authenticated;
insert into cam select n, (select id from ids where chave = 'loja_a') || '/' || (select id from ids where chave = 'os_aberta') || '/f' || n || '.jpg'
  from generate_series(1, 9) n;

select ok((select relrowsecurity from pg_class where oid = 'public.os_fotos'::regclass), 'os_fotos tem RLS');
select ok((select not public from storage.buckets where id = 'os_arquivos'), 'Bucket de fotos é privado');

select testes.entrar_como((select id from ids where chave = 'atend_a'));
select lives_ok(
  format($$insert into os_fotos (loja_id, os_id, momento, caminho) select %L, %L, 'entrada', c from cam where n <= 8$$,
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_aberta')),
  'Atendente envia 8 fotos de entrada');
select throws_ok(
  format($$insert into os_fotos (loja_id, os_id, momento, caminho) select %L, %L, 'entrada', c from cam where n = 9$$,
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_aberta')),
  'P0001', 'Já há 8 fotos neste momento. Apague uma para enviar outra.', 'A 9ª foto do mesmo momento é recusada');
select throws_ok(
  format($$insert into os_fotos (loja_id, os_id, momento, caminho) values (%L, %L, 'saida', 'outra-loja/x/f.jpg')$$,
    (select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_aberta')),
  '23514', null, 'Caminho fora da pasta da OS é recusado');
select testes.sair();

-- Uma foto na OS que vai ser encerrada.
insert into os_fotos (loja_id, os_id, momento, caminho) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'os_fechada'), 'saida',
   (select id from ids where chave = 'loja_a') || '/' || (select id from ids where chave = 'os_fechada') || '/s.jpg');
update ordens_servico set status = 'entregue' where observacao = 'fechada';

select testes.entrar_como((select id from ids where chave = 'atend_a'));
select throws_ok(
  format($$delete from os_fotos where os_id = %L$$, (select id from ids where chave = 'os_fechada')),
  'P0001', 'A OS já foi encerrada.', 'Foto de OS encerrada não é apagada');
select lives_ok(
  format($$delete from os_fotos where caminho = (select c from cam where n = 1)$$),
  'Foto de OS aberta é apagada');
select testes.sair();

select testes.entrar_como((select id from ids where chave = 'dono_b'));
select is_empty($$select id from os_fotos$$, 'Outra loja não vê as fotos');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('os_arquivos', %L)$$, (select c from cam where n = 9)),
  '42501', null, 'Outra loja não grava arquivo na pasta da loja A');
select testes.sair();

select * from finish();
rollback;
