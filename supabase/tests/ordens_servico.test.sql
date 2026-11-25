begin;
select plan(22);

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

insert into admins_plataforma (user_id) select id from ids where chave = 'admin';

-- Numeração inicial de cada loja
update config_loja set os_numero_inicial = 1000 where loja_id = (select id from ids where chave = 'loja_a');
update config_loja set os_numero_inicial = 50   where loja_id = (select id from ids where chave = 'loja_b');

insert into clientes (loja_id, nome, telefone)
values ((select id from ids where chave = 'loja_a'), 'Maria Cliente', '11999990000');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.ordens_servico'::regclass),
  'ordens_servico tem RLS habilitada');

-- O bloqueio por linha da loja evita o número duplicado; este índice único
-- transforma qualquer escape em erro visível (concorrência real não é
-- exercitável numa única sessão).
select col_is_unique('public', 'ordens_servico', array['loja_id', 'numero'],
  'unique (loja_id, numero) existe');

-- Numeração -------------------------------------------------------------
insert into ordens_servico (loja_id, cliente_id, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'),
        (select id from clientes limit 1), 'celular', 'Tela quebrada');
insert into ordens_servico (loja_id, cliente_id, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'),
        (select id from clientes limit 1), 'tablet', 'Não carrega');
insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_b'), true, 'celular', 'Estoque');
insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_b'), true, 'celular', 'Estoque 2');

select is(
  (select min(numero) from ordens_servico where loja_id = (select id from ids where chave = 'loja_a')),
  1000, 'A primeira OS da loja A recebe o número inicial configurado');
select is(
  (select max(numero) from ordens_servico where loja_id = (select id from ids where chave = 'loja_a')),
  1001, 'A segunda OS da loja A recebe o número seguinte');
select is(
  (select array_agg(numero order by numero) from ordens_servico where loja_id = (select id from ids where chave = 'loja_b')),
  array[50, 51],
  'A loja B numera de forma independente, a partir do próprio inicial');
select is(
  (select status::text from ordens_servico where numero = 1000),
  'aberta', 'Status inicial é aberta');

-- Número nunca reaproveitado: apagar a última OS não libera o número.
insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'), true, 'celular', 'Temporária');
select is(
  (select max(numero) from ordens_servico where loja_id = (select id from ids where chave = 'loja_a')),
  1002, 'A terceira OS da loja A recebe 1002');
delete from ordens_servico where numero = 1002
  and loja_id = (select id from ids where chave = 'loja_a');
insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'), true, 'celular', 'Depois da exclusão');
select is(
  (select max(numero) from ordens_servico where loja_id = (select id from ids where chave = 'loja_a')),
  1003, 'Após apagar a OS 1002, a próxima OS recebe 1003 e não reaproveita 1002');
delete from ordens_servico where numero = 1003
  and loja_id = (select id from ids where chave = 'loja_a');

-- Coerência cliente x interna -------------------------------------------
select throws_ok(
  format($$insert into ordens_servico (loja_id, interna, cliente_id, aparelho_tipo, defeito_relatado)
           values (%L, true, %L, 'celular', 'x')$$,
         (select id from ids where chave = 'loja_a'), (select id from clientes limit 1)),
  '23514', null, 'OS interna não pode ter cliente');
select throws_ok(
  format($$insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
           values (%L, false, 'celular', 'x')$$,
         (select id from ids where chave = 'loja_a')),
  '23514', null, 'OS de cliente exige cliente');

-- Dono A ----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));

select is(
  (select array_agg(numero order by numero) from ordens_servico),
  array[1000, 1001], 'Dono A lê apenas as OS da loja A');
select results_eq(
  $$update ordens_servico set laudo = 'Trocar tela' where numero = 1000 returning laudo$$,
  array['Trocar tela'],
  'Dono A atualiza OS da própria loja');

select throws_ok(
  $$update ordens_servico set numero = 9999 where numero = 1000$$,
  '42501', null, 'Dono A não troca o número de uma OS');
select throws_ok(
  format($$update ordens_servico set loja_id = %L where numero = 1000$$,
         (select id from ids where chave = 'loja_b')),
  '42501', 'Não é permitido trocar o número ou a loja de uma ordem de serviço',
  'Dono A não troca a loja de uma OS (barrado pelo gatilho, não pela RLS)');
select is(
  (select numero from ordens_servico where laudo = 'Trocar tela'),
  1000, 'O número da OS segue o original após as tentativas de troca');
select lives_ok(
  $$update ordens_servico set observacao = 'Cliente avisado' where numero = 1000$$,
  'Dono A ainda atualiza colunas comuns da OS');
-- Sem assertion de atualizado_em: now() é fixo dentro da transação do pgTAP,
-- então o avanço não é observável aqui. Não mude o gatilho para clock_timestamp().

-- Dono B ----------------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));

select is(
  (select array_agg(numero order by numero) from ordens_servico),
  array[50, 51], 'Dono B lê apenas as OS da loja B');
select is_empty(
  $$update ordens_servico set laudo = 'x' where numero in (1000, 1001) returning id$$,
  'Dono B não atualiza OS da loja A');
select throws_ok(
  format($$insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
           values (%L, true, 'celular', 'Intruso')$$,
         (select id from ids where chave = 'loja_a')),
  '42501', null, 'Dono B não insere OS na loja A');

select testes.sair();
select is(
  (select laudo from ordens_servico where numero = 1000),
  'Trocar tela',
  'OS da loja A segue intacta após as tentativas do Dono B');

-- Admin em suporte ------------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
insert into acessos_suporte (loja_id, expira_em)
values ((select id from ids where chave = 'loja_a'), now() + interval '24 hours');

select testes.entrar_como((select id from ids where chave = 'admin'));
select is((select count(*) from ordens_servico), 2::bigint,
  'Admin em suporte lê as OS de A');
select throws_ok(
  format($$insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
           values (%L, true, 'celular', 'Suporte')$$,
         (select id from ids where chave = 'loja_a')),
  '42501', null, 'Admin em suporte não insere OS');

select * from finish();
rollback;
