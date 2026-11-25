-- Numeração por contador, não por max(numero)+1: apagar a última OS não pode
-- liberar o número, que já foi impresso no comprovante do cliente.
alter table public.config_loja
  add column os_ultimo_numero int not null default 0 check (os_ultimo_numero >= 0);

-- O próprio UPDATE trava a linha de config_loja da loja, então duas OS
-- simultâneas na mesma loja são numeradas em fila.
create or replace function public.numerar_os()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update config_loja
     set os_ultimo_numero = greatest(os_ultimo_numero + 1, os_numero_inicial)
   where loja_id = new.loja_id
  returning os_ultimo_numero into new.numero;

  -- Defesa: todo config_loja nasce com a loja, mas sem a linha ainda numeramos.
  if not found then
    select coalesce(max(numero) + 1, 1) into new.numero
    from ordens_servico where loja_id = new.loja_id;
  end if;
  return new;
end;
$$;

-- clock_timestamp(): now() congela no início da transação e não avançaria
-- entre dois updates da mesma transação.
create or replace function public.os_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := clock_timestamp();
  return new;
end;
$$;
