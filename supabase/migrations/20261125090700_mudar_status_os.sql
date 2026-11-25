-- Mudança de status da OS: o status novo e a linha do histórico são gravados
-- na mesma transação, para nunca divergirem. O supabase-js não tem transação,
-- então o app não consegue fazer isso em duas chamadas: um status mudado sem
-- registro, ou um histórico (à prova de adulteração) afirmando uma mudança
-- que não houve, seria pior que qualquer falha limpa.
--
-- security invoker: a RLS vale exatamente como valeria num update direto, e a
-- função não dá a ninguém nada que já não tivesse. As regras de transição
-- (podeMudar) ficam no TypeScript, por desenho; o app as confere antes de
-- chamar. Aqui só se garante a consistência status + histórico.
create function public.mudar_status_os(
  os uuid,
  de public.status_os,
  para public.status_os,
  observacao text default null
)
returns void
language plpgsql security invoker
set search_path = public, pg_temp
as $$
declare
  v_de public.status_os;
  v_loja uuid;
  v_membro uuid;
begin
  -- FOR UPDATE: duas mudanças simultâneas se enfileiram, e o histórico de
  -- cada uma registra o status que ela de fato substituiu. Sob RLS, quem não
  -- enxerga ou não pode escrever na OS (outra loja, suporte) não a recebe.
  select o.status, o.loja_id into v_de, v_loja
  from ordens_servico o
  where o.id = os
  for update of o;

  if v_loja is null then
    raise exception 'OS não encontrada' using errcode = 'P0001';
  end if;

  -- Concorrência otimista: quem chama diz contra qual status validou a
  -- transição (podeMudar, no app). Se outra pessoa mexeu antes, a validação
  -- ficou velha: recusa sem mudar nada.
  if v_de is distinct from mudar_status_os.de then
    raise exception 'A etapa mudou enquanto você olhava. Recarregue a tela e tente de novo.'
      using errcode = 'P0001';
  end if;

  select m.id into v_membro
  from membros m
  where m.user_id = auth.uid() and m.ativo and m.loja_id = v_loja;

  update ordens_servico set status = para where id = os;

  insert into os_historico (os_id, loja_id, de_status, para_status, membro_id, observacao)
  values (os, v_loja, v_de, para, v_membro, mudar_status_os.observacao);
end;
$$;

revoke all on function public.mudar_status_os(uuid, public.status_os, public.status_os, text)
  from public, anon, authenticated, service_role;
grant execute on function public.mudar_status_os(uuid, public.status_os, public.status_os, text) to authenticated;

-- Abertura da OS no histórico ----------------------------------------------
-- O histórico é a história da OS: começa na entrada do aparelho (de_status
-- nulo). Em gatilho, é atômico com o insert da OS e vale para qualquer via de
-- criação. security invoker: a RLS vale como para qualquer insert no histórico.
create function public.os_registra_abertura()
returns trigger
language plpgsql security invoker
set search_path = public, pg_temp
as $$
begin
  insert into os_historico (os_id, loja_id, de_status, para_status, membro_id)
  values (
    new.id, new.loja_id, null, new.status,
    (select m.id from membros m
     where m.user_id = auth.uid() and m.ativo and m.loja_id = new.loja_id));
  return null;
end;
$$;

create trigger os_abertura_historico
  after insert on public.ordens_servico
  for each row execute function public.os_registra_abertura();
