-- Fase B: orçamento da OS. Testes das garantias estruturais:
-- RLS por loja, no máximo um orçamento vigente por OS, desconto coerente,
-- preço não negativo, e trigger de atualizado_em.
begin;
select plan(14);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values
  ('dono_a', testes.criar_usuario('dono.a@teste.local')),
  ('dono_b', testes.criar_usuario('dono.b@teste.local'));

insert into planos (nome, modulos, limite_usuarios)
values ('TesteOrc', '{servico}', 5);

with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteOrc'
  returning id)
insert into ids select 'loja_a', id from l;
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja B', id, '{servico}' from planos where nome = 'TesteOrc'
  returning id)
insert into ids select 'loja_b', id from l;

insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'), 'Dono A', 'dono'),
  ((select id from ids where chave = 'loja_b'), (select id from ids where chave = 'dono_b'), 'Dono B', 'dono');

insert into clientes (loja_id, nome, telefone) values
  ((select id from ids where chave = 'loja_a'), 'Maria', '11999990000');

insert into ordens_servico (loja_id, cliente_id, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'),
        (select id from clientes where loja_id = (select id from ids where chave = 'loja_a') limit 1),
        'celular', 'Tela');
insert into ids
  select 'os_a', id from ordens_servico
  where loja_id = (select id from ids where chave = 'loja_a') limit 1;

-- Estrutura ---------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.os_orcamentos'::regclass),
  'os_orcamentos tem RLS habilitada');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.os_orcamento_itens'::regclass),
  'os_orcamento_itens tem RLS habilitada');
select has_type('public', 'status_orcamento',
  'enum status_orcamento existe');

-- Um só orçamento vigente por OS -----------------------------------------
insert into os_orcamentos (loja_id, os_id)
values ((select id from ids where chave = 'loja_a'),
        (select id from ids where chave = 'os_a'));
select throws_ok(
  format($$insert into os_orcamentos (loja_id, os_id, versao)
           values (%L, %L, 2)$$,
         (select id from ids where chave = 'loja_a'),
         (select id from ids where chave = 'os_a')),
  '23505', null,
  'Não deixa dois orçamentos vigentes na mesma OS');

-- Pode haver um vigente e vários substituídos:
update os_orcamentos set status = 'substituido'
  where os_id = (select id from ids where chave = 'os_a');
insert into os_orcamentos (loja_id, os_id, versao, status)
values ((select id from ids where chave = 'loja_a'),
        (select id from ids where chave = 'os_a'), 2, 'rascunho');
select is(
  (select count(*)::int from os_orcamentos where os_id = (select id from ids where chave = 'os_a')),
  2, 'Permite vários substituídos + um vigente');

-- Desconto coerente -------------------------------------------------------
select throws_ok(
  format($$insert into os_orcamentos (loja_id, os_id, desconto_valor, desconto_percentual, versao)
           values (%L, %L, 10, 5, 99)$$,
         (select id from ids where chave = 'loja_a'),
         (select id from ids where chave = 'os_a')),
  '23514', null,
  'Não deixa desconto em valor e em percentual juntos');
select throws_ok(
  format($$insert into os_orcamentos (loja_id, os_id, desconto_valor, versao)
           values (%L, %L, -10, 99)$$,
         (select id from ids where chave = 'loja_a'),
         (select id from ids where chave = 'os_a')),
  '23514', null,
  'Não deixa desconto negativo');
select throws_ok(
  format($$insert into os_orcamentos (loja_id, os_id, desconto_percentual, versao)
           values (%L, %L, 150, 99)$$,
         (select id from ids where chave = 'loja_a'),
         (select id from ids where chave = 'os_a')),
  '23514', null,
  'Não deixa desconto percentual > 100');

-- Item com preço negativo / quantidade zero ------------------------------
select throws_ok(
  format($$insert into os_orcamento_itens (orcamento_id, loja_id, descricao, preco_unitario)
           values ((select id from os_orcamentos where os_id = %L and status = 'rascunho'), %L, 'x', -5)$$,
         (select id from ids where chave = 'os_a'),
         (select id from ids where chave = 'loja_a')),
  '23514', null,
  'Item não aceita preço negativo');
select throws_ok(
  format($$insert into os_orcamento_itens (orcamento_id, loja_id, descricao, preco_unitario, quantidade)
           values ((select id from os_orcamentos where os_id = %L and status = 'rascunho'), %L, 'x', 10, 0)$$,
         (select id from ids where chave = 'os_a'),
         (select id from ids where chave = 'loja_a')),
  '23514', null,
  'Item não aceita quantidade zero');

-- Isolamento por loja ----------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_b'));
select is_empty(
  $$select id from os_orcamentos$$,
  'Dono B não lê orçamentos de A');
select throws_ok(
  format($$insert into os_orcamentos (loja_id, os_id)
           values (%L, %L)$$,
         (select id from ids where chave = 'loja_a'),
         (select id from ids where chave = 'os_a')),
  '42501', null,
  'Dono B não insere orçamento em OS de A');
select testes.sair();

-- Dono A lê o próprio -----------------------------------------------------
select testes.entrar_como((select id from ids where chave = 'dono_a'));
select is(
  (select count(*)::int from os_orcamentos),
  2, 'Dono A lê ambos (vigente + substituído) da própria loja');

-- atualizado_em avança no update -----------------------------------------
-- (now() é fixo dentro da transação pgTAP; usamos a existência do trigger)
select has_trigger('public', 'os_orcamentos', 'orcamento_atualizado_em',
  'Trigger orcamento_atualizado_em existe');
select testes.sair();

select * from finish();
rollback;
