-- Quantas peças da OS ainda estão sem custo. Técnico e atendente não leem
-- os_pecas_custo, mas precisam saber que a entrega vai esperar o Dono: esta
-- função devolve só a contagem, nunca o valor. security definer para enxergar
-- os_pecas_custo; a loja é conferida à mão.
create function public.pecas_sem_custo(os uuid)
returns int
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_loja uuid;
begin
  select o.loja_id into v_loja from ordens_servico o where o.id = pecas_sem_custo.os;
  if v_loja is null
     or v_loja is distinct from public.minha_loja()
     or not public.loja_liberada(v_loja) then
    return 0;
  end if;
  return (
    select count(*)::int from os_pecas p
     where p.os_id = pecas_sem_custo.os
       and not exists (select 1 from os_pecas_custo c where c.peca_id = p.id));
end;
$$;

revoke all on function public.pecas_sem_custo(uuid) from public, anon, authenticated, service_role;
grant execute on function public.pecas_sem_custo(uuid) to authenticated;
