-- Fluxo do orçamento: enviar, aprovar (manual, pelo atendente), recusar e
-- criar nova versão. Cada função muda o orçamento e o status da OS na mesma
-- transação, com o histórico da OS (via mudar_status_os).
--
-- Quem pode o quê:
--  * Usuário logado cria o orçamento (versão 1, rascunho), mexe nos itens, no
--    desconto e nas peças da OS, mas só enquanto o orçamento vigente está em
--    rascunho.
--  * Status, aprovação e versões só mudam por estas funções. Elas rodam
--    security definer (precisam gravar colunas que o usuário não grava) e por
--    isso conferem a loja à mão: minha_loja(), loja_liberada() e em_suporte().
--
-- Concorrência: cada função trava a OS e depois o orçamento (sempre nessa
-- ordem) e confere o status do orçamento. Dois cliques em "Aprovar": o
-- segundo encontra o orçamento já aprovado e recebe a mensagem de "mudou".

-- 1. Item preso ao orçamento da MESMA loja ----------------------------------
-- O vínculo simples deixava um usuário da loja B pendurar um item no
-- orçamento da loja A (bastava conhecer o id). O vínculo composto fecha isso.
alter table public.os_orcamento_itens
  drop constraint os_orcamento_itens_orcamento_id_fkey,
  add constraint os_orcamento_itens_orcamento_loja_fkey
    foreign key (orcamento_id, loja_id)
    references public.os_orcamentos (id, loja_id) on delete cascade;

-- 2. Colunas que o usuário grava direto -------------------------------------
revoke insert, update, delete on public.os_orcamentos from authenticated, anon;
grant insert (loja_id, os_id, desconto_valor, desconto_percentual)
  on public.os_orcamentos to authenticated;
grant update (desconto_valor, desconto_percentual)
  on public.os_orcamentos to authenticated;

-- 3. Trava do que já foi enviado --------------------------------------------
create function public.orcamento_so_rascunho()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon') and old.status <> 'rascunho' then
    raise exception 'Este orçamento já foi enviado. Para alterar, crie uma nova versão.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger orcamento_so_rascunho before update on public.os_orcamentos
  for each row execute function public.orcamento_so_rascunho();

create function public.item_orcamento_so_rascunho()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status public.status_orcamento;
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  select status into v_status from os_orcamentos
   where id = coalesce(new.orcamento_id, old.orcamento_id);
  if v_status is distinct from 'rascunho' then
    raise exception 'Este orçamento já foi enviado. Para alterar, crie uma nova versão.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger item_orcamento_so_rascunho
  before insert or update or delete on public.os_orcamento_itens
  for each row execute function public.item_orcamento_so_rascunho();

-- Peças entram no total cobrado: depois de enviado o orçamento, mudar peça
-- também exige nova versão. O custo (os_pecas_custo) segue livre para o Dono.
create function public.pecas_so_com_orcamento_aberto()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and exists (
       select 1 from os_orcamentos
        where os_id = coalesce(new.os_id, old.os_id)
          and status in ('enviado', 'aprovado')) then
    raise exception 'O orçamento já foi enviado. Para mudar as peças, crie uma nova versão.'
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger pecas_so_com_orcamento_aberto
  before insert or update or delete on public.os_pecas
  for each row execute function public.pecas_so_com_orcamento_aberto();

-- 4. Funções do fluxo --------------------------------------------------------

-- Trava OS e orçamento (nessa ordem) e confere a loja de quem chama.
create function public.travar_orcamento(orc uuid)
returns public.os_orcamentos
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_os uuid;
  v_orc public.os_orcamentos;
begin
  select os_id into v_os from os_orcamentos where id = orc;
  if v_os is null then
    raise exception 'Orçamento não encontrado' using errcode = 'P0001';
  end if;
  perform 1 from ordens_servico where id = v_os for update;
  select * into v_orc from os_orcamentos where id = orc for update;
  if v_orc.loja_id is distinct from public.minha_loja()
     or not public.loja_liberada(v_orc.loja_id)
     or public.em_suporte() then
    raise exception 'Orçamento não encontrado' using errcode = 'P0001';
  end if;
  return v_orc;
end;
$$;

revoke all on function public.travar_orcamento(uuid) from public, anon, authenticated, service_role;

create function public.orcamento_tem_conteudo(v_orc public.os_orcamentos)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$
  select exists (select 1 from os_orcamento_itens where orcamento_id = v_orc.id)
      or exists (select 1 from os_pecas where os_id = v_orc.os_id);
$$;

revoke all on function public.orcamento_tem_conteudo(public.os_orcamentos)
  from public, anon, authenticated, service_role;

create function public.enviar_orcamento_os(orc uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_orc public.os_orcamentos := public.travar_orcamento(orc);
  v_os_status public.status_os;
begin
  if v_orc.status <> 'rascunho' then
    raise exception 'O orçamento mudou enquanto você olhava. Recarregue a tela e tente de novo.'
      using errcode = 'P0001';
  end if;
  if not public.orcamento_tem_conteudo(v_orc) then
    raise exception 'O orçamento não tem itens.' using errcode = 'P0001';
  end if;

  select status into v_os_status from ordens_servico where id = v_orc.os_id;
  if v_os_status = 'em_analise' then
    perform public.mudar_status_os(v_orc.os_id, v_os_status, 'orcamento_enviado');
  elsif v_os_status = 'aberta' then
    raise exception 'Coloque a OS em análise antes de enviar o orçamento.' using errcode = 'P0001';
  elsif v_os_status <> 'orcamento_enviado' then
    raise exception 'A OS não está numa etapa que aceita orçamento.' using errcode = 'P0001';
  end if;

  update os_orcamentos set status = 'enviado' where id = orc;
end;
$$;

create function public.aprovar_orcamento_os(orc uuid, por text, meio text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_orc public.os_orcamentos := public.travar_orcamento(orc);
  v_os_status public.status_os;
  v_por text := nullif(trim(por), '');
begin
  if v_orc.status not in ('rascunho', 'enviado') then
    raise exception 'O orçamento mudou enquanto você olhava. Recarregue a tela e tente de novo.'
      using errcode = 'P0001';
  end if;
  if v_por is null then
    raise exception 'Informe quem aprovou.' using errcode = 'P0001';
  end if;
  if length(v_por) > 80 then
    raise exception 'Nome de quem aprovou: no máximo 80 caracteres.' using errcode = 'P0001';
  end if;
  if meio is null or meio not in ('balcao', 'telefone', 'whatsapp', 'outro') then
    raise exception 'Informe como o cliente aprovou.' using errcode = 'P0001';
  end if;
  if not public.orcamento_tem_conteudo(v_orc) then
    raise exception 'O orçamento não tem itens.' using errcode = 'P0001';
  end if;

  select status into v_os_status from ordens_servico where id = v_orc.os_id;
  if v_os_status not in ('aberta', 'em_analise', 'orcamento_enviado') then
    raise exception 'A OS não está numa etapa que aceita orçamento.' using errcode = 'P0001';
  end if;
  perform public.mudar_status_os(v_orc.os_id, v_os_status, 'aprovado',
    format('Orçamento v%s aprovado por %s (%s)', v_orc.versao, v_por, meio));

  update os_orcamentos
     set status = 'aprovado', aprovado_por = v_por,
         aprovado_meio = meio, aprovado_em = now()
   where id = orc;
end;
$$;

create function public.recusar_orcamento_os(orc uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_orc public.os_orcamentos := public.travar_orcamento(orc);
  v_os_status public.status_os;
begin
  if v_orc.status <> 'enviado' then
    raise exception 'O orçamento mudou enquanto você olhava. Recarregue a tela e tente de novo.'
      using errcode = 'P0001';
  end if;
  select status into v_os_status from ordens_servico where id = v_orc.os_id;
  if v_os_status <> 'orcamento_enviado' then
    raise exception 'A OS não está numa etapa que aceita orçamento.' using errcode = 'P0001';
  end if;
  perform public.mudar_status_os(v_orc.os_id, v_os_status, 'recusado',
    format('Orçamento v%s recusado', v_orc.versao));

  update os_orcamentos set status = 'recusado', recusado_em = now() where id = orc;
end;
$$;

-- Nova versão a partir de um orçamento enviado ou aprovado: a antiga vira
-- "substituido", a nova nasce em rascunho com os mesmos itens e desconto. Se a
-- OS já tinha passado da aprovação, volta para "orçamento enviado" e pede
-- nova aprovação (spec 8.4). Devolve o id do novo orçamento.
create function public.editar_orcamento_os(orc uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_orc public.os_orcamentos := public.travar_orcamento(orc);
  v_os_status public.status_os;
  v_versao int;
  v_novo uuid;
begin
  if v_orc.status not in ('enviado', 'aprovado') then
    raise exception 'O orçamento mudou enquanto você olhava. Recarregue a tela e tente de novo.'
      using errcode = 'P0001';
  end if;
  select status into v_os_status from ordens_servico where id = v_orc.os_id;
  if v_os_status not in ('orcamento_enviado', 'aprovado', 'aguardando_peca', 'em_servico', 'pronto') then
    raise exception 'A OS não está numa etapa que aceita orçamento.' using errcode = 'P0001';
  end if;

  select max(versao) + 1 into v_versao from os_orcamentos where os_id = v_orc.os_id;

  update os_orcamentos set status = 'substituido' where id = orc;
  insert into os_orcamentos (loja_id, os_id, versao, desconto_valor, desconto_percentual)
  values (v_orc.loja_id, v_orc.os_id, v_versao, v_orc.desconto_valor, v_orc.desconto_percentual)
  returning id into v_novo;
  insert into os_orcamento_itens (orcamento_id, loja_id, descricao, servico_id, quantidade, preco_unitario, ordem)
  select v_novo, loja_id, descricao, servico_id, quantidade, preco_unitario, ordem
    from os_orcamento_itens where orcamento_id = orc;

  if v_os_status <> 'orcamento_enviado' then
    perform public.mudar_status_os(v_orc.os_id, v_os_status, 'orcamento_enviado',
      format('Orçamento alterado (versão %s): precisa de nova aprovação', v_versao));
  end if;
  return v_novo;
end;
$$;

revoke all on function public.enviar_orcamento_os(uuid) from public, anon, authenticated, service_role;
revoke all on function public.aprovar_orcamento_os(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.recusar_orcamento_os(uuid) from public, anon, authenticated, service_role;
revoke all on function public.editar_orcamento_os(uuid) from public, anon, authenticated, service_role;
grant execute on function public.enviar_orcamento_os(uuid) to authenticated;
grant execute on function public.aprovar_orcamento_os(uuid, text, text) to authenticated;
grant execute on function public.recusar_orcamento_os(uuid) to authenticated;
grant execute on function public.editar_orcamento_os(uuid) to authenticated;
