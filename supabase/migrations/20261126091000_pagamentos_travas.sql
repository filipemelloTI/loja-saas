-- Travas do dinheiro recebido:
--  * OS encerrada não recebe, nem perde, nem muda pagamento: os números já
--    foram congelados na entrega.
--  * Apagar ou corrigir um pagamento já lançado é só do Dono. Atendente e
--    técnico lançam; quem desfaz é o Dono (e tudo fica na auditoria).
-- A função de entrega roda como servidor e não passa por estas travas.
create function public.travar_pagamentos_os()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status public.status_os;
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  select status into v_status from ordens_servico where id = coalesce(new.os_id, old.os_id);
  if v_status in ('entregue', 'devolvido') then
    raise exception 'A OS já foi encerrada.' using errcode = 'P0001';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and public.meu_perfil() is distinct from 'dono' then
    raise exception 'Só o Dono corrige um pagamento já lançado.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger travar_pagamentos_os
  before insert or update or delete on public.os_pagamentos
  for each row execute function public.travar_pagamentos_os();
