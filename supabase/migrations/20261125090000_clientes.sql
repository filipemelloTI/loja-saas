-- Clientes da loja: compartilhados entre Serviço e Vendas. Os três perfis
-- (dono, técnico, atendente) leem e escrevem. CPF é dado sensível: sem
-- auditoria (o registro copiaria o CPF) e fora de qualquer URL ou log.

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  nome text not null,
  telefone text not null,
  cpf text,
  email text,
  endereco text,
  nascimento date,
  criado_em timestamptz not null default now(),
  unique (id, loja_id)
);
create index clientes_loja_nome_idx on public.clientes (loja_id, nome);
create index clientes_loja_telefone_idx on public.clientes (loja_id, telefone);
create index clientes_loja_cpf_idx on public.clientes (loja_id, cpf);

-- RLS --------------------------------------------------------------------
-- Leitura: toda a loja liberada. Escrita: toda a loja liberada, nunca o
-- admin em suporte.
alter table public.clientes enable row level security;

create policy clientes_leitura on public.clientes
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy clientes_escreve on public.clientes
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and not public.em_suporte()
  );
