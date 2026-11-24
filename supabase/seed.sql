-- Dados de desenvolvimento local (supabase db reset). Não usar em produção.

insert into public.planos (nome, modulos, limite_usuarios)
values ('Completo', '{servico,estoque,vendas,fornecedores,financeiro}', 5);

-- Admin da plataforma local: admin@local.test / admin123 (só desenvolvimento).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'admin@local.test',
  extensions.crypt('admin123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'email',
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@local.test","email_verified":true}',
  now(), now(), now()
);

insert into public.admins_plataforma (user_id)
values ('a0000000-0000-0000-0000-000000000001');
