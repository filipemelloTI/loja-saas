begin;
select plan(11);

-- Só nesta transação (rollback no fim): permite trocar de usuário
-- estando já no papel authenticated.
grant usage on schema testes to authenticated, service_role;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated, service_role;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated, service_role;

insert into ids values
  ('dono',    testes.criar_usuario('dono.e@teste.local')),
  ('tecnico', testes.criar_usuario('tecnico.e@teste.local')),
  ('novo',    testes.criar_usuario('novo.e@teste.local')),
  ('outro',   testes.criar_usuario('outro.e@teste.local')),
  ('admin',   testes.criar_usuario('admin.e@teste.local'));

insert into admins_plataforma (user_id) select id from ids where chave = 'admin';
insert into planos (nome, modulos, limite_usuarios) values ('Teste Endurecimento', '{servico}', 10);

with l as (
  insert into lojas (nome, plano_id, modulos)
  select x.nome, p.id, '{servico}' from planos p, (values ('Loja E1'), ('Loja E2')) as x (nome)
  where p.nome = 'Teste Endurecimento'
  returning id, nome)
insert into ids select case nome when 'Loja E1' then 'loja' else 'loja2' end, id from l;

insert into membros (loja_id, user_id, nome, perfil)
select (select id from ids where chave = 'loja'), (select id from ids where chave = u.chave), u.nome, u.perfil::perfil
from (values ('dono', 'Dono', 'dono'), ('tecnico', 'Técnico', 'tecnico')) as u (chave, nome, perfil);

-- Membros: Dono não insere direto nem troca user_id/loja_id ----------------
select testes.entrar_como((select id from ids where chave = 'dono'));

select throws_ok(
  format($$insert into membros (loja_id, user_id, nome, perfil) values (%L, %L, 'Novo', 'atendente')$$,
         (select id from ids where chave = 'loja'), (select id from ids where chave = 'novo')),
  '42501', null,
  'Dono não insere em membros direto (só o servidor, com service role)');

select throws_ok(
  format($$update membros set user_id = %L where user_id = %L$$,
         (select id from ids where chave = 'novo'), (select id from ids where chave = 'tecnico')),
  '42501', null,
  'Dono não troca o user_id de um membro');

select throws_ok(
  format($$update membros set loja_id = %L where user_id = %L$$,
         (select id from ids where chave = 'loja2'), (select id from ids where chave = 'tecnico')),
  '42501', null,
  'Dono não muda um membro de loja');

select results_eq(
  format($$update membros set nome = 'Técnico 2', perfil = 'atendente' where user_id = %L returning nome$$,
         (select id from ids where chave = 'tecnico')),
  $$values ('Técnico 2'::text)$$,
  'Dono ainda edita nome e perfil do membro');

-- Service role: insere membro, mas nunca um admin da plataforma ------------
select testes.sair();
set local role service_role;

select lives_ok(
  format($$insert into membros (loja_id, user_id, nome, perfil) values (%L, %L, 'Novo', 'atendente')$$,
         (select id from ids where chave = 'loja'), (select id from ids where chave = 'novo')),
  'Service role insere membro');

select throws_ok(
  format($$insert into membros (loja_id, user_id, nome, perfil) values (%L, %L, 'Admin', 'dono')$$,
         (select id from ids where chave = 'loja'), (select id from ids where chave = 'admin')),
  'P0001', 'Admin da plataforma não pode ser membro de loja',
  'Admin da plataforma não vira membro de loja');

reset role;

-- Bucket de logos ---------------------------------------------------------
select is(
  (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'logos'),
  row(false, 1048576::bigint, array['image/png', 'image/jpeg', 'image/webp'])::text,
  'Bucket logos é privado, até 1 MB, só PNG/JPG/WebP');

select testes.entrar_como((select id from ids where chave = 'tecnico'));
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('logos', %L)$$,
         (select id from ids where chave = 'loja') || '/logo.png'),
  '42501', null,
  'Técnico não envia logo');

select testes.entrar_como((select id from ids where chave = 'dono'));
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('logos', %L)$$,
         (select id from ids where chave = 'loja') || '/logo.png'),
  'Dono envia a logo na pasta da própria loja');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('logos', %L)$$,
         (select id from ids where chave = 'loja2') || '/logo.png'),
  '42501', null,
  'Dono não envia logo na pasta de outra loja');

select testes.entrar_como((select id from ids where chave = 'novo'));
select isnt_empty(
  $$select 1 from storage.objects where bucket_id = 'logos'$$,
  'Membro da loja lê a logo');

select * from finish();
rollback;
