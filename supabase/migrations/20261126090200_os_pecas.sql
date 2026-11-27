-- Peças usadas na OS, lançadas à mão (descrição, quantidade e preço cobrado).
-- A spec (13.1) exige esse caminho mesmo quando a loja não tem o módulo
-- Estoque; a escolha da peça a partir do estoque entra junto com aquele módulo.
--
-- O custo fica numa tabela à parte que só o Dono lê e escreve, no mesmo padrão
-- de servicos/servicos_custo: técnico e atendente lançam a peça sem ver o custo.
-- Peça sem linha em os_pecas_custo = custo pendente; a entrega da OS é barrada
-- enquanto houver alguma pendente.

create table public.os_pecas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  os_id uuid not null,
  descricao text not null check (length(trim(descricao)) > 0),
  quantidade int not null default 1 check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  criado_em timestamptz not null default now(),
  unique (id, loja_id),
  foreign key (os_id, loja_id) references public.ordens_servico (id, loja_id)
);
create index os_pecas_os_idx on public.os_pecas (os_id);
create index os_pecas_loja_idx on public.os_pecas (loja_id);

create table public.os_pecas_custo (
  peca_id uuid primary key,
  loja_id uuid not null references public.lojas (id),
  custo_unitario numeric(10,2) not null check (custo_unitario >= 0),
  foreign key (peca_id, loja_id) references public.os_pecas (id, loja_id) on delete cascade
);
create index os_pecas_custo_loja_idx on public.os_pecas_custo (loja_id);

create trigger auditoria_os_pecas_custo after insert or update or delete on public.os_pecas_custo
  for each row execute function public.registrar_auditoria();

-- RLS --------------------------------------------------------------------
alter table public.os_pecas enable row level security;
alter table public.os_pecas_custo enable row level security;

-- os_pecas: os três perfis leem e escrevem; admin em suporte só lê.
create policy os_pecas_leitura on public.os_pecas
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy os_pecas_escreve on public.os_pecas
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte())
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte());

-- os_pecas_custo: só Dono.
create policy os_pecas_custo_dono_leitura on public.os_pecas_custo
  for select to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono');
create policy os_pecas_custo_dono_escreve on public.os_pecas_custo
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte())
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte());
