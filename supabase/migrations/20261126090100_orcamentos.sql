-- Orçamento da OS: a loja monta, envia, e registra a resposta do cliente
-- (nesta fase, resposta manual pelo atendente — balcão, telefone ou WhatsApp
-- fora do sistema). Cada OS tem no máximo UM orçamento vigente (rascunho,
-- enviado ou aprovado) e várias versões antigas (substituido, recusado).
-- Alterar orçamento aprovado cria uma nova versão e marca a anterior como
-- substituido — ver 20261126090400_aprovar_recusar.sql.

create type public.status_orcamento as enum
  ('rascunho', 'enviado', 'aprovado', 'recusado', 'substituido');

create table public.os_orcamentos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  os_id uuid not null,
  versao int not null default 1 check (versao > 0),
  status public.status_orcamento not null default 'rascunho',
  desconto_valor numeric(10,2),
  desconto_percentual numeric(5,2),
  -- Aprovação manual pelo atendente (fase B — sem link público).
  aprovado_por text,
  aprovado_meio text check (aprovado_meio in ('balcao','telefone','whatsapp','outro')),
  aprovado_em timestamptz,
  recusado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (id, loja_id),
  unique (os_id, versao),
  foreign key (os_id, loja_id) references public.ordens_servico (id, loja_id),
  constraint desconto_um_so check (
    desconto_valor is null or desconto_percentual is null),
  constraint desconto_positivo check (
    (desconto_valor is null or desconto_valor >= 0)
    and (desconto_percentual is null
         or (desconto_percentual >= 0 and desconto_percentual <= 100)))
);

-- Garante um só orçamento vigente por OS. Versões antigas (substituido,
-- recusado) ficam fora do índice: o histórico completo cabe junto.
create unique index os_orcamentos_vigente_un
  on public.os_orcamentos (os_id)
  where status in ('rascunho','enviado','aprovado');

create index os_orcamentos_loja_idx on public.os_orcamentos (loja_id);

create table public.os_orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.os_orcamentos (id) on delete cascade,
  loja_id uuid not null references public.lojas (id),
  descricao text not null check (length(trim(descricao)) > 0),
  servico_id uuid,
  quantidade int not null default 1 check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create index os_orcamento_itens_orc_idx on public.os_orcamento_itens (orcamento_id);

create function public.orcamento_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger orcamento_atualizado_em before update on public.os_orcamentos
  for each row execute function public.orcamento_atualizado_em();

-- RLS --------------------------------------------------------------------
alter table public.os_orcamentos enable row level security;
alter table public.os_orcamento_itens enable row level security;

create policy orcamento_leitura on public.os_orcamentos
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy orcamento_escreve on public.os_orcamentos
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte())
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte());

create policy orcamento_item_leitura on public.os_orcamento_itens
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy orcamento_item_escreve on public.os_orcamento_itens
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte())
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte());
