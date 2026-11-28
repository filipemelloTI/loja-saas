-- Assinatura do cliente com o dedo (spec 8.2): uma na entrada e uma na
-- entrega, como PNG no bucket `os_arquivos` (pasta da loja e da OS).
-- Entrada: enquanto a OS está aberta. Entrega: só com a OS pronta.
-- Depois de encerrada, nada muda. Refazer substitui.

create table public.os_assinaturas (
  os_id uuid not null,
  loja_id uuid not null references public.lojas (id),
  momento text not null check (momento in ('entrada', 'entrega')),
  caminho text not null,
  criado_em timestamptz not null default now(),
  primary key (os_id, momento),
  foreign key (os_id, loja_id) references public.ordens_servico (id, loja_id) on delete cascade,
  constraint assinatura_na_pasta_da_os check (caminho like loja_id::text || '/' || os_id::text || '/%')
);

create function public.travar_assinaturas_os()
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
  if tg_op <> 'DELETE' and new.momento = 'entrega' and v_status not in ('pronto', 'pronto_devolucao') then
    raise exception 'A assinatura de entrega é feita com a OS pronta.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger travar_assinaturas_os before insert or update or delete on public.os_assinaturas
  for each row execute function public.travar_assinaturas_os();

alter table public.os_assinaturas enable row level security;

create policy os_assinaturas_leitura on public.os_assinaturas
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy os_assinaturas_escreve on public.os_assinaturas
  for all to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id) and not public.em_suporte())
  with check (loja_id = public.minha_loja() and public.loja_liberada(loja_id) and not public.em_suporte());

-- Refazer a assinatura regrava o mesmo arquivo: o storage precisa permitir update.
create policy os_arquivos_atualiza on storage.objects
  for update to authenticated
  using (
    bucket_id = 'os_arquivos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja())
    and not public.em_suporte())
  with check (
    bucket_id = 'os_arquivos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja())
    and not public.em_suporte());
