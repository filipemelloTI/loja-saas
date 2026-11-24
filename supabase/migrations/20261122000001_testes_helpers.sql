-- Helpers para os testes pgTAP (supabase/tests). Não são expostos à API:
-- nada é concedido a anon/authenticated.

create extension if not exists pgtap with schema extensions;

create schema if not exists testes;
revoke all on schema testes from public;

-- Cria um usuário mínimo em auth.users e devolve o id.
create function testes.criar_usuario(email text)
returns uuid
language sql
as $$
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', email, now(), now())
  returning id;
$$;

-- Passa a agir como o usuário: role authenticated + claims do JWT (auth.uid()).
create function testes.entrar_como(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- Volta para o papel da sessão e limpa as claims.
create function testes.sair()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

revoke all on all functions in schema testes from public;
