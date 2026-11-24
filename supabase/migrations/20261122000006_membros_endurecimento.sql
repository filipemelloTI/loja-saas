-- Membros: inclusão só pelo servidor (service role), que cria o usuário no
-- Auth e confere o Dono antes. Assim o Dono não consegue "adotar" um usuário
-- existente (inclusive o admin da plataforma) gravando direto pela API.

drop policy membros_dono_insere on public.membros;

-- user_id e loja_id não mudam depois de criados, exceto pelo servidor.
create function public.proteger_vinculo_membro()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.user_id, new.loja_id) is distinct from (old.user_id, old.loja_id) then
    raise exception 'Não é permitido trocar o usuário ou a loja de um membro'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_vinculo_membro before update on public.membros
  for each row execute function public.proteger_vinculo_membro();

-- O admin da plataforma nunca é membro: em_suporte() depende disso.
create function public.recusar_admin_como_membro()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from admins_plataforma where user_id = new.user_id) then
    raise exception 'Admin da plataforma não pode ser membro de loja' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger recusar_admin_como_membro before insert or update of user_id on public.membros
  for each row execute function public.recusar_admin_como_membro();
