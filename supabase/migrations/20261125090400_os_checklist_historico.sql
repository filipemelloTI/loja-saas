-- Checklist de avarias registrado na entrada do aparelho e histórico de
-- status da OS. As duas tabelas dependem da OS (apagar a OS leva junto).

-- O checklist é uma fotografia: `nome` copia o texto do item no momento do
-- registro e NÃO referencia checklist_itens. A loja pode renomear, desativar
-- ou apagar itens da lista depois; a OS mantém o que foi visto no balcão,
-- que é o que protege a loja numa disputa.
create table public.os_checklist (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null,
  loja_id uuid not null references public.lojas (id),
  nome text not null,
  marcado boolean not null default false,
  observacao text,
  foreign key (os_id, loja_id)
    references public.ordens_servico (id, loja_id) on delete cascade
);
create index os_checklist_os_idx on public.os_checklist (os_id);

-- Histórico de mudanças de status: só inserção e leitura.
create table public.os_historico (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null,
  loja_id uuid not null references public.lojas (id),
  de_status public.status_os,
  para_status public.status_os not null,
  membro_id uuid,
  observacao text,
  criado_em timestamptz not null default now(),
  foreign key (os_id, loja_id)
    references public.ordens_servico (id, loja_id) on delete cascade,
  foreign key (membro_id, loja_id) references public.membros (id, loja_id)
);
create index os_historico_os_idx on public.os_historico (os_id, criado_em);

-- RLS --------------------------------------------------------------------
alter table public.os_checklist enable row level security;
alter table public.os_historico enable row level security;

create policy os_checklist_leitura on public.os_checklist
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy os_checklist_escreve on public.os_checklist
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte()
  );

create policy os_historico_leitura on public.os_historico
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy os_historico_insere on public.os_historico
  for insert to authenticated
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte()
  );
-- Sem política de update/delete: a RLS já esconderia as linhas, mas sem o
-- revoke o comando "passaria" apagando zero linhas em silêncio. Revogar o
-- privilégio faz a recusa ser um erro explícito (42501). A cascata da OS não
-- depende deste privilégio.
revoke update, delete on public.os_historico from authenticated;
