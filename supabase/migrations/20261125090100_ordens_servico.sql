-- Ordens de serviço (OS): o aparelho que o cliente deixa para reparo, ou um
-- aparelho do próprio estoque da loja (OS interna, sem cliente). Os três
-- perfis leem e escrevem; o admin em suporte só lê.

create type public.tipo_aparelho as enum
  ('celular', 'tablet', 'relogio', 'notebook', 'outro');

create type public.status_os as enum (
  'aberta', 'em_analise', 'orcamento_enviado', 'aprovado', 'recusado',
  'aguardando_peca', 'em_servico', 'pronto', 'pronto_devolucao',
  'entregue', 'devolvido');

create table public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  numero int not null,
  cliente_id uuid,
  interna boolean not null default false,
  aparelho_tipo public.tipo_aparelho not null,
  marca text,
  modelo text,
  cor text,
  imei text,
  defeito_relatado text not null,
  acessorios text[] not null default '{}',
  observacao text,
  tecnico_id uuid,
  laudo text,
  previsao_entrega date,
  status public.status_os not null default 'aberta',
  encerrada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, loja_id),
  unique (loja_id, numero),
  foreign key (cliente_id, loja_id) references public.clientes (id, loja_id),
  foreign key (tecnico_id, loja_id) references public.membros (id, loja_id),
  constraint os_cliente_coerente check (
    (interna and cliente_id is null) or (not interna and cliente_id is not null))
);
create index os_loja_status_idx on public.ordens_servico (loja_id, status);
create index os_loja_criado_idx on public.ordens_servico (loja_id, criado_em desc);
create index os_loja_imei_idx on public.ordens_servico (loja_id, imei);

-- Numeração sequencial por loja, começando em config_loja.os_numero_inicial.
-- Trava a linha da loja (mesma técnica de verificar_limite_usuarios) para
-- duas OS simultâneas não pegarem o mesmo número; unique (loja_id, numero)
-- é a rede de segurança que transforma qualquer escape em erro visível.
create function public.numerar_os()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform 1 from lojas where id = new.loja_id for update;

  select greatest(
           coalesce(max(o.numero) + 1, 1),
           (select c.os_numero_inicial from config_loja c
            where c.loja_id = new.loja_id))
    into new.numero
  from ordens_servico o
  where o.loja_id = new.loja_id;
  return new;
end;
$$;

create trigger numerar_os before insert on public.ordens_servico
  for each row execute function public.numerar_os();

create function public.os_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger os_atualizado_em before update on public.ordens_servico
  for each row execute function public.os_atualizado_em();

-- RLS --------------------------------------------------------------------
alter table public.ordens_servico enable row level security;

create policy os_leitura on public.ordens_servico
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy os_escreve on public.ordens_servico
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte()
  );
