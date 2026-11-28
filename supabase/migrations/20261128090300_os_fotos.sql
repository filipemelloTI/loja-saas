-- Fotos do aparelho na entrada e na saída (spec 8.2). Arquivos no bucket
-- privado `os_arquivos`, em `<loja_id>/<os_id>/<arquivo>`; a tabela guarda o
-- momento e o caminho. Os três perfis enviam e veem; o admin em suporte só vê.
-- Apagar, só antes de a OS ser encerrada. No máximo 8 fotos por momento.
-- O mesmo bucket guarda as assinaturas (migração seguinte).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('os_arquivos', 'os_arquivos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']);

create policy os_arquivos_leitura on storage.objects
  for select to authenticated
  using (
    bucket_id = 'os_arquivos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja()));

create policy os_arquivos_insere on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'os_arquivos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja())
    and not public.em_suporte());

create policy os_arquivos_apaga on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'os_arquivos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja())
    and not public.em_suporte());

create table public.os_fotos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  os_id uuid not null,
  momento text not null check (momento in ('entrada', 'saida')),
  caminho text not null unique,
  criado_em timestamptz not null default now(),
  foreign key (os_id, loja_id) references public.ordens_servico (id, loja_id) on delete cascade,
  -- O arquivo mora na pasta da própria loja e da própria OS.
  constraint foto_na_pasta_da_os check (caminho like loja_id::text || '/' || os_id::text || '/%')
);
create index os_fotos_os_idx on public.os_fotos (os_id, momento, criado_em);

create function public.travar_fotos_os()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_os uuid := coalesce(new.os_id, old.os_id);
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from os_fotos where os_id = v_os and momento = new.momento) >= 8 then
      raise exception 'Já há 8 fotos neste momento. Apague uma para enviar outra.' using errcode = 'P0001';
    end if;
  elsif exists (select 1 from ordens_servico where id = v_os and status in ('entregue', 'devolvido')) then
    raise exception 'A OS já foi encerrada.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger travar_fotos_os before insert or delete on public.os_fotos
  for each row execute function public.travar_fotos_os();

alter table public.os_fotos enable row level security;
revoke update on public.os_fotos from authenticated, anon;

create policy os_fotos_leitura on public.os_fotos
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy os_fotos_insere on public.os_fotos
  for insert to authenticated
  with check (loja_id = public.minha_loja() and public.loja_liberada(loja_id) and not public.em_suporte());
create policy os_fotos_apaga on public.os_fotos
  for delete to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id) and not public.em_suporte());
