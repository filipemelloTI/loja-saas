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

-- Contador monotônico por loja: apagar a última OS NÃO pode liberar o número,
-- que já foi impresso no comprovante do cliente.
alter table public.config_loja
  add column os_ultimo_numero int not null default 0 check (os_ultimo_numero >= 0);

-- Numeração sequencial por loja, começando em config_loja.os_numero_inicial.
-- O próprio UPDATE trava a linha de config_loja da loja, então duas OS simultâneas na
-- mesma loja são numeradas em fila; unique (loja_id, numero) é a rede de segurança
-- que transforma qualquer escape em erro visível.
create function public.numerar_os()
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

create trigger numerar_os before insert on public.ordens_servico
  for each row execute function public.numerar_os();

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
