begin;
select plan(46);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('dono_a',   testes.criar_usuario('dono.a@teste.local')),
  ('tec_a',    testes.criar_usuario('tec.a@teste.local')),
  ('atend_a',  testes.criar_usuario('atend.a@teste.local')),
  ('dono_b',   testes.criar_usuario('dono.b@teste.local')),
  ('admin',    testes.criar_usuario('admin@teste.local'));

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
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'),  'Dono A',  'dono'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'tec_a'),   'Tec A',   'tecnico'),
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'atend_a'), 'Atend A', 'atendente'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'),  'Dono B',  'dono');

insert into admins_plataforma (user_id) select id from ids where chave = 'admin';

-- Três OS na loja A (aberta, será entregue, será devolvida) e uma na B.
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
  values ((select id from ids where chave = 'loja_a'), true, 'celular', 'OS A3')
  returning id)
insert into ids select 'os_a3', id from o;
with o as (
  insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
  values ((select id from ids where chave = 'loja_b'), true, 'celular', 'OS B1')
  returning id)
insert into ids select 'os_b1', id from o;

-- Estrutura e privilégios -----------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.os_senha_aparelho'::regclass),
  'os_senha_aparelho tem RLS habilitada');

select ok(
  not (has_table_privilege('authenticated', 'public.os_senha_aparelho', 'select, insert, update, delete')
    or has_table_privilege('authenticated', 'public.os_senha_aparelho', 'select')
    or has_table_privilege('authenticated', 'public.os_senha_aparelho', 'insert')
    or has_table_privilege('authenticated', 'public.os_senha_aparelho', 'update')
    or has_table_privilege('authenticated', 'public.os_senha_aparelho', 'delete')),
  'authenticated não tem nenhum privilégio na tabela da senha');
select ok(
  not (has_table_privilege('anon', 'public.os_senha_aparelho', 'select')
    or has_table_privilege('anon', 'public.os_senha_aparelho', 'insert')
    or has_table_privilege('anon', 'public.os_senha_aparelho', 'update')
    or has_table_privilege('anon', 'public.os_senha_aparelho', 'delete')),
  'anon não tem nenhum privilégio na tabela da senha');
select ok(
  not (has_table_privilege('service_role', 'public.os_senha_aparelho', 'select')
    or has_table_privilege('service_role', 'public.os_senha_aparelho', 'insert')
    or has_table_privilege('service_role', 'public.os_senha_aparelho', 'update')
    or has_table_privilege('service_role', 'public.os_senha_aparelho', 'delete')),
  'service_role (chave de serviço da plataforma) não tem privilégio na tabela da senha');

select ok(
  not (has_function_privilege('authenticated', 'public.chave_senha_aparelho()', 'execute')
    or has_function_privilege('anon', 'public.chave_senha_aparelho()', 'execute')
    or has_function_privilege('service_role', 'public.chave_senha_aparelho()', 'execute')),
  'A função que devolve a chave não é executável por authenticated, anon nem service_role');
select ok(
  has_function_privilege('authenticated', 'public.senha_aparelho(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.guardar_senha_aparelho(uuid, text)', 'execute'),
  'authenticated executa as duas funções públicas');
select ok(
  not (has_function_privilege('anon', 'public.senha_aparelho(uuid)', 'execute')
    or has_function_privilege('anon', 'public.guardar_senha_aparelho(uuid, text)', 'execute')),
  'anon não executa as funções da senha');

select ok(
  (select length(decrypted_secret) >= 32 from vault.decrypted_secrets
   where name = 'senha_aparelho_chave'),
  'A chave existe no Vault e tem tamanho de chave de verdade');

-- Guardar ----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select lives_ok(
  format($$select public.guardar_senha_aparelho(%L, 'S3nh@-Cl1ente-A1')$$,
         (select id from ids where chave = 'os_a1')),
  'Dono A guarda a senha da OS A1');
select lives_ok(
  format($$select public.guardar_senha_aparelho(%L, 'Padrao-A2')$$,
         (select id from ids where chave = 'os_a2')),
  'Dono A guarda a senha da OS A2');
select lives_ok(
  format($$select public.guardar_senha_aparelho(%L, 'Padrao-A3')$$,
         (select id from ids where chave = 'os_a3')),
  'Dono A guarda a senha da OS A3');

select testes.entrar_como((select id from ids where chave = 'dono_b'));
select lives_ok(
  format($$select public.guardar_senha_aparelho(%L, 'S3nh@-Loja-B')$$,
         (select id from ids where chave = 'os_b1')),
  'Dono B guarda a senha da OS B1');

-- A coluna guardada não é texto puro -------------------------------------
select testes.sair();
select is(
  (select count(*) from public.os_senha_aparelho), 4::bigint,
  'Há 4 senhas guardadas (A1, A2, A3, B1)');
select is(
  (select count(*) from public.os_senha_aparelho
   where position(convert_to('S3nh@-Cl1ente-A1', 'UTF8') in senha_cifrada) > 0
      or senha_cifrada::text like '%S3nh@-Cl1ente-A1%'),
  0::bigint, 'A senha não aparece em claro na coluna cifrada');
select is(
  (select extensions.pgp_sym_decrypt(senha_cifrada,
            (select decrypted_secret from vault.decrypted_secrets where name = 'senha_aparelho_chave'))
   from public.os_senha_aparelho
   where os_id = (select id from ids where chave = 'os_a1')),
  'S3nh@-Cl1ente-A1', 'A coluna é de fato cifrada com a chave do Vault (decifra de volta)');
select throws_ok(
  format($$select extensions.pgp_sym_decrypt(senha_cifrada, 'chave-errada')
           from public.os_senha_aparelho where os_id = %L$$,
         (select id from ids where chave = 'os_a1')),
  '39000', null, 'Com outra chave a coluna não decifra');

-- Quem lê ----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select is(
  public.senha_aparelho((select id from ids where chave = 'os_a1')),
  'S3nh@-Cl1ente-A1', 'Dono da loja A recebe a senha original');

select testes.entrar_como((select id from ids where chave = 'tec_a'));
select is(
  public.senha_aparelho((select id from ids where chave = 'os_a1')),
  'S3nh@-Cl1ente-A1', 'Técnico da loja A recebe a senha original');

select testes.entrar_como((select id from ids where chave = 'atend_a'));
select is(
  public.senha_aparelho((select id from ids where chave = 'os_a1')),
  null, 'Atendente da loja A recebe null (não é o trabalho dele)');

select testes.entrar_como((select id from ids where chave = 'dono_b'));
select is(
  public.senha_aparelho((select id from ids where chave = 'os_a1')),
  null, 'Dono da loja B recebe null para a OS da loja A');
select is(
  public.senha_aparelho(gen_random_uuid()),
  null, 'OS inexistente também devolve null (mesma resposta: sem oráculo)');
select is(
  public.senha_aparelho(null),
  null, 'Argumento nulo devolve null em vez de erro');
select is(
  public.senha_aparelho((select id from ids where chave = 'os_b1')),
  'S3nh@-Loja-B', 'Dono da loja B recebe a senha da própria OS');

-- Acesso direto à tabela é recusado, não "silenciosamente vazio" ---------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select throws_ok(
  $$select * from public.os_senha_aparelho$$,
  '42501', null, 'Dono não lê a tabela da senha diretamente');
select throws_ok(
  format($$insert into public.os_senha_aparelho (os_id, loja_id, senha_cifrada)
           values (%L, %L, '\x00')$$,
         (select id from ids where chave = 'os_a1'), (select id from ids where chave = 'loja_a')),
  '42501', null, 'Dono não insere direto na tabela da senha');
select throws_ok(
  $$update public.os_senha_aparelho set senha_cifrada = '\x00'$$,
  '42501', null, 'Dono não atualiza direto a tabela da senha');
select throws_ok(
  $$delete from public.os_senha_aparelho$$,
  '42501', null, 'Dono não apaga direto da tabela da senha');
select is(
  public.senha_aparelho((select id from ids where chave = 'os_a1')),
  'S3nh@-Cl1ente-A1', 'A senha da A1 segue intacta após as tentativas diretas');

-- Quem escreve -----------------------------------------------------------
-- Atendente registra a senha na entrada do aparelho (mesmo sem poder lê-la).
select testes.entrar_como((select id from ids where chave = 'atend_a'));
select lives_ok(
  format($$select public.guardar_senha_aparelho(%L, 'S3nh@-Do-Balcao')$$,
         (select id from ids where chave = 'os_a1')),
  'Atendente da loja A registra (troca) a senha da OS');
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select is(
  public.senha_aparelho((select id from ids where chave = 'os_a1')),
  'S3nh@-Do-Balcao', 'A troca feita pelo atendente é a senha que o dono lê');
select testes.sair();
select is(
  (select count(*) from public.os_senha_aparelho
   where os_id = (select id from ids where chave = 'os_a1')),
  1::bigint, 'Trocar a senha não duplica a linha (uma por OS)');

-- Escritas negadas levantam erro e nada muda ------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));
select throws_ok(
  format($$select public.guardar_senha_aparelho(%L, 'Invasor')$$,
         (select id from ids where chave = 'os_a1')),
  '42501', 'sem permissão para guardar a senha',
  'Dono B não grava senha na OS da loja A');
select throws_ok(
  format($$select public.guardar_senha_aparelho(%L, 'Invasor')$$, gen_random_uuid()),
  '42501', 'sem permissão para guardar a senha',
  'OS inexistente é recusada com o mesmo erro (sem oráculo de existência)');

-- Admin em suporte -------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
insert into acessos_suporte (loja_id, expira_em)
values ((select id from ids where chave = 'loja_a'), now() + interval '24 hours');

select testes.entrar_como((select id from ids where chave = 'admin'));
select is(
  public.senha_aparelho((select id from ids where chave = 'os_a1')),
  null, 'Admin em suporte recebe null: suporte não enxerga segredo de cliente');
select throws_ok(
  format($$select public.guardar_senha_aparelho(%L, 'Suporte')$$,
         (select id from ids where chave = 'os_a1')),
  '42501', 'sem permissão para guardar a senha',
  'Admin em suporte não grava senha');

-- Re-leitura: nenhuma das recusas acima mexeu na senha da A1 e da B1
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select is(
  public.senha_aparelho((select id from ids where chave = 'os_a1')),
  'S3nh@-Do-Balcao', 'Senha da A1 intacta após as tentativas de Dono B e do admin em suporte');
select testes.entrar_como((select id from ids where chave = 'dono_b'));
select is(
  public.senha_aparelho((select id from ids where chave = 'os_b1')),
  'S3nh@-Loja-B', 'Senha da B1 intacta');

-- Efêmera: some quando a OS é encerrada ----------------------------------
select testes.sair();
select is(
  (select count(*) from public.os_senha_aparelho
   where os_id in ((select id from ids where chave = 'os_a2'),
                   (select id from ids where chave = 'os_a3'))),
  2::bigint, 'Antes de encerrar, A2 e A3 têm senha guardada');

select testes.entrar_como((select id from ids where chave = 'dono_a'));
update ordens_servico set status = 'em_analise'
where id = (select id from ids where chave = 'os_a1');
update ordens_servico set status = 'entregue'
where id = (select id from ids where chave = 'os_a2');
update ordens_servico set status = 'devolvido'
where id = (select id from ids where chave = 'os_a3');

select testes.sair();
select is_empty(
  format($$select 1 from public.os_senha_aparelho where os_id = %L$$,
         (select id from ids where chave = 'os_a2')),
  'OS entregue: a linha da senha sumiu');
select is_empty(
  format($$select 1 from public.os_senha_aparelho where os_id = %L$$,
         (select id from ids where chave = 'os_a3')),
  'OS devolvida: a linha da senha sumiu');
select is(
  (select count(*) from ordens_servico
   where id in ((select id from ids where chave = 'os_a2'),
                (select id from ids where chave = 'os_a3'))
     and encerrada_em is not null),
  2::bigint, 'As duas OS encerradas ganharam encerrada_em');
select is(
  (select encerrada_em from ordens_servico where id = (select id from ids where chave = 'os_a1')),
  null, 'Mudar para um status não terminal não marca encerrada_em');
select is(
  (select count(*) from public.os_senha_aparelho
   where os_id = (select id from ids where chave = 'os_a1')),
  1::bigint, 'Mudar para um status não terminal não apaga a senha');

select testes.entrar_como((select id from ids where chave = 'dono_a'));
select is(
  public.senha_aparelho((select id from ids where chave = 'os_a2')),
  null, 'Depois de entregue, nem o dono lê a senha');
select throws_ok(
  format($$select public.guardar_senha_aparelho(%L, 'Tarde-Demais')$$,
         (select id from ids where chave = 'os_a2')),
  '42501', 'sem permissão para guardar a senha',
  'Não se guarda senha em OS já encerrada');
select testes.sair();
select is(
  (select count(*) from public.os_senha_aparelho
   where os_id = (select id from ids where chave = 'os_a2')),
  0::bigint, 'A tentativa em OS encerrada não recriou a linha');

select * from finish();
rollback;
