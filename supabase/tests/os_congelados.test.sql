-- Colunas de encerramento da OS: usuário logado não grava, nem na abertura
-- nem depois; o servidor grava; colunas comuns seguem editáveis.
begin;
select plan(11);

grant usage on schema testes to authenticated;
grant execute on function testes.entrar_como(uuid), testes.sair() to authenticated;

create temp table ids (chave text primary key, id uuid) on commit drop;
grant select on ids to authenticated;

insert into ids values ('dono_a', testes.criar_usuario('dono.a@teste.local'));

insert into planos (nome, modulos, limite_usuarios)
values ('TesteCong', '{servico}', 5);
with l as (
  insert into lojas (nome, plano_id, modulos)
  select 'Loja A', id, '{servico}' from planos where nome = 'TesteCong'
  returning id)
insert into ids select 'loja_a', id from l;
insert into membros (loja_id, user_id, nome, perfil) values
  ((select id from ids where chave = 'loja_a'), (select id from ids where chave = 'dono_a'), 'Dono A', 'dono');

insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado)
values ((select id from ids where chave = 'loja_a'), true, 'celular', 'Tela');
insert into ids
  select 'os_a', id from ordens_servico
  where loja_id = (select id from ids where chave = 'loja_a') limit 1;

select has_column('public', 'ordens_servico', 'total_congelado', 'total_congelado existe');
select has_column('public', 'ordens_servico', 'custo_pecas_congelado', 'custo_pecas_congelado existe');
select has_column('public', 'ordens_servico', 'comissao_percentual_congelado', 'comissao_percentual_congelado existe');
select has_column('public', 'ordens_servico', 'comissao_congelada', 'comissao_congelada existe');
select has_column('public', 'ordens_servico', 'lucro_congelado', 'lucro_congelado existe');
select has_column('public', 'ordens_servico', 'tecnico_congelado_id', 'tecnico_congelado_id existe');

select testes.entrar_como((select id from ids where chave = 'dono_a'));
select throws_ok(
  format($$update ordens_servico set lucro_congelado = 9999 where id = %L$$,
         (select id from ids where chave = 'os_a')),
  '42501', 'Os valores de encerramento da OS só são gravados na entrega',
  'Nem o Dono grava lucro congelado à mão');
select throws_ok(
  format($$update ordens_servico set comissao_percentual_congelado = 0 where id = %L$$,
         (select id from ids where chave = 'os_a')),
  '42501', null,
  'Nem o Dono zera a % de comissão congelada');
select throws_ok(
  format($$insert into ordens_servico (loja_id, interna, aparelho_tipo, defeito_relatado, total_congelado)
           values (%L, true, 'celular', 'x', 100)$$,
         (select id from ids where chave = 'loja_a')),
  '42501', null,
  'Não se abre OS já com valores de encerramento');
select lives_ok(
  format($$update ordens_servico set laudo = 'Trocar tela' where id = %L$$,
         (select id from ids where chave = 'os_a')),
  'Colunas comuns seguem editáveis');
select testes.sair();

-- O servidor (aqui, o dono do banco no teste) grava normalmente.
select lives_ok(
  format($$update ordens_servico set total_congelado = 650, lucro_congelado = 259 where id = %L$$,
         (select id from ids where chave = 'os_a')),
  'Servidor grava os valores de encerramento');

select * from finish();
rollback;
