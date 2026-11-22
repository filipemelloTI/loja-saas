begin;
select plan(6);

-- Só nesta transação (rollback no fim): permite trocar de usuário
-- estando já no papel authenticated.
grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select, insert on ids to authenticated, service_role;

insert into ids values
  ('admin',  testes.criar_usuario('admin.u@teste.local')),
  ('dono_a', testes.criar_usuario('dono.a.u@teste.local')),
  ('tec_a',  testes.criar_usuario('tec.a.u@teste.local')),
  ('inat_a', testes.criar_usuario('inat.a.u@teste.local')),
  ('dono_b', testes.criar_usuario('dono.b.u@teste.local'));

insert into admins_plataforma (user_id) select id from ids where chave = 'admin';
insert into planos (nome, modulos, limite_usuarios) values ('Teste Uso', '{servico}', 5);

with l as (
  insert into lojas (nome, plano_id, modulos)
  select x.nome, p.id, '{servico}' from planos p, (values ('Loja Uso A'), ('Loja Uso B')) as x (nome)
  where p.nome = 'Teste Uso'
  returning id, nome)
insert into ids select case nome when 'Loja Uso A' then 'loja_a' else 'loja_b' end, id from l;

insert into membros (loja_id, user_id, nome, perfil, ativo)
select (select id from ids where chave = u.loja), (select id from ids where chave = u.usuario),
       u.nome, u.perfil::perfil, u.ativo
from (values
  ('loja_a', 'dono_a', 'Dono A',     'dono',    true),
  ('loja_a', 'tec_a',  'Técnico A',  'tecnico', true),
  ('loja_a', 'inat_a', 'Inativo A',  'tecnico', false),
  ('loja_b', 'dono_b', 'Dono B',     'dono',    true)
) as u (loja, usuario, nome, perfil, ativo);

update auth.users set last_sign_in_at = '2026-11-20 10:00+00'
where id = (select id from ids where chave = 'dono_a');
update auth.users set last_sign_in_at = '2026-11-21 15:00+00'
where id = (select id from ids where chave = 'tec_a');

-- Admin da plataforma ----------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'admin'));

select is(
  (select count(*) from uso_lojas() where nome in ('Loja Uso A', 'Loja Uso B')),
  2::bigint,
  'Admin recebe uma linha para cada uma das 2 lojas');

select results_eq(
  $$select nome, plano, usuarios_ativos, ultimo_acesso from uso_lojas()
    where nome in ('Loja Uso A', 'Loja Uso B') order by nome$$,
  $$values ('Loja Uso A'::text, 'Teste Uso'::text, 2, '2026-11-21 15:00+00'::timestamptz),
           ('Loja Uso B'::text, 'Teste Uso'::text, 1, null::timestamptz)$$,
  'Usuários ativos não contam inativos; último acesso é o mais recente dos membros');

select throws_ok(
  format('select desfazer_loja_nova(%L)', (select id from ids where chave = 'loja_b')),
  '42501', null,
  'Admin logado não chama desfazer_loja_nova (só o servidor, com service role)');

select testes.sair();

-- Dono -------------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));

select throws_ok(
  'select * from uso_lojas()',
  '42501', 'Acesso negado',
  'Dono chamando uso_lojas() recebe Acesso negado');

select testes.sair();

-- Desfazer loja recém-criada (rollback do criarLoja, como service role) --
set local role service_role;

with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja Desfazer', id, '{servico}' from planos where nome = 'Teste Uso'
  returning id)
insert into ids select 'loja_nova', id from l;

select desfazer_loja_nova((select id from ids where chave = 'loja_nova'));

select ok(
  not exists (select 1 from lojas where id = (select id from ids where chave = 'loja_nova'))
  and not exists (select 1 from config_loja where loja_id = (select id from ids where chave = 'loja_nova'))
  and not exists (select 1 from checklist_itens where loja_id = (select id from ids where chave = 'loja_nova')),
  'desfazer_loja_nova apaga a loja e os padrões semeados');

select throws_ok(
  format('select desfazer_loja_nova(%L)', (select id from ids where chave = 'loja_a')),
  'P0001', 'A loja já tem usuários',
  'desfazer_loja_nova não apaga loja que já tem usuários');

reset role;

select * from finish();
rollback;
