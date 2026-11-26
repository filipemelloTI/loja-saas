-- Pagamentos da OS: uma linha por forma usada (Pix 300 + crédito 2x 350 =
-- duas linhas). `sinal` é o adiantamento na aprovação; `final` é o que se
-- recebe na entrega. A forma precisa estar entre as que a loja aceita
-- (config_loja.formas_pagamento). O teto (soma não passa do total da OS) é
-- conferido na ação do servidor, que conhece o total do orçamento.

create type public.tipo_pagamento_os as enum ('sinal', 'final');

create table public.os_pagamentos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  os_id uuid not null,
  tipo public.tipo_pagamento_os not null,
  forma text not null,
  parcelas int,
  valor numeric(10,2) not null check (valor > 0),
  registrado_em timestamptz not null default now(),
  foreign key (os_id, loja_id) references public.ordens_servico (id, loja_id),
  constraint parcelas_so_credito check (
    (forma = 'credito' and parcelas is not null and parcelas between 1 and 24)
    or (forma <> 'credito' and parcelas is null))
);
create index os_pagamentos_os_idx on public.os_pagamentos (os_id);
create index os_pagamentos_loja_idx on public.os_pagamentos (loja_id);

create function public.validar_forma_pagamento_os()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_formas text[];
begin
  select formas_pagamento into v_formas from config_loja where loja_id = new.loja_id;
  if v_formas is null or not (new.forma = any (v_formas)) then
    raise exception 'Esta forma de pagamento não está ativa na loja.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger validar_forma_pagamento_os before insert or update on public.os_pagamentos
  for each row execute function public.validar_forma_pagamento_os();

-- Dinheiro recebido: toda inclusão, correção e exclusão fica registrada.
create trigger auditoria_os_pagamentos after insert or update or delete on public.os_pagamentos
  for each row execute function public.registrar_auditoria();

-- RLS --------------------------------------------------------------------
alter table public.os_pagamentos enable row level security;

create policy os_pagamentos_leitura on public.os_pagamentos
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy os_pagamentos_escreve on public.os_pagamentos
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte())
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte());
