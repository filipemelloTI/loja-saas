-- O número da OS vai impresso no comprovante do cliente: depois de criada,
-- nem ele nem a loja da OS mudam, exceto pelo servidor.
create function public.proteger_numero_os()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.numero, new.loja_id) is distinct from (old.numero, old.loja_id) then
    raise exception 'Não é permitido trocar o número ou a loja de uma ordem de serviço'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_numero_os before update on public.ordens_servico
  for each row execute function public.proteger_numero_os();
