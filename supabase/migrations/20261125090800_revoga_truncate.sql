-- TRUNCATE ignora a RLS: um usuário autenticado qualquer, com `TRUNCATE` concedido,
-- apagaria o conteúdo da tabela de todas as lojas numa chamada só. O Supabase concede
-- TODAS as permissões de tabela (incluindo TRUNCATE) para `authenticated` e `anon` por
-- padrão, então precisamos tirá-las explicitamente de todas as tabelas do schema
-- `public`, inclusive das tabelas da fundação. Hoje PostgREST não expõe TRUNCATE, mas
-- fechamos a porta assim mesmo — não queremos depender da ausência de um caminho.
--
-- `delete` continua liberado (a RLS filtra por loja). Esta migração só tira `truncate`.
revoke truncate on all tables in schema public from authenticated, anon;

-- Vale para tabelas futuras também: sem um default, a próxima `create table` em
-- `public` reabriria o buraco. Como o papel que roda migrações no Supabase é o
-- `postgres`, os defaults dele são os que o `authenticated`/`anon` herdam.
alter default privileges in schema public
  revoke truncate on tables from authenticated, anon;
