-- Volta atualizado_em ao now() padrão do esquema (mesma base de tempo de
-- criado_em); a versão anterior usava clock_timestamp() só por causa de teste.
create or replace function public.os_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;
