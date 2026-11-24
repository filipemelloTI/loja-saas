-- Logo da loja: bucket privado `logos`, um arquivo por loja em
-- `<loja_id>/logo.<ext>`. Membros da loja (e o admin em suporte) leem;
-- só o Dono escreve, nunca em suporte. Exibição por URL assinada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', false, 1048576, array['image/png', 'image/jpeg', 'image/webp']);

create policy logos_leitura on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja())
  );

create policy logos_dono_insere on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja())
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );

create policy logos_dono_atualiza on storage.objects
  for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja())
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja())
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );

create policy logos_dono_apaga on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = public.minha_loja()::text
    and public.loja_liberada(public.minha_loja())
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );
