-- Entrega da OS (spec 8.5 e 8.6): confere custos e pagamento, muda o status
-- para "entregue" (o gatilho da Fase A carimba encerrada_em e apaga a senha
-- do aparelho) e congela total, custo das peças, comissão e lucro. Tudo numa
-- transação só.

-- 1. Entregar só pela função de entrega ---------------------------------------
-- Sem esta trava, o botão de etapa levaria a OS a "entregue" sem congelar
-- nada. O corpo é o da Fase A, com a checagem nova no começo.
create or replace function public.mudar_status_os(
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
  v_linhas bigint;
begin
  if para = 'entregue' and current_user in ('authenticated', 'anon') then
    raise exception 'Use o botão Entregar para encerrar a OS.' using errcode = 'P0001';
  end if;

  select o.status, o.loja_id into v_de, v_loja
  from ordens_servico o
  where o.id = os
  for update of o;

  if v_loja is null then
    raise exception 'OS não encontrada' using errcode = 'P0001';
  end if;

  if v_de is distinct from mudar_status_os.de then
    raise exception 'A etapa mudou enquanto você olhava. Recarregue a tela e tente de novo.'
      using errcode = 'P0001';
  end if;

  select m.id into v_membro
  from membros m
  where m.user_id = auth.uid() and m.ativo and m.loja_id = v_loja;

  update ordens_servico set status = para where id = os;
  get diagnostics v_linhas = row_count;
  if v_linhas = 0 then
    raise exception 'Não foi possível mudar a etapa da OS.' using errcode = 'P0001';
  end if;

  insert into os_historico (os_id, loja_id, de_status, para_status, membro_id, observacao)
  values (os, v_loja, v_de, para, v_membro, mudar_status_os.observacao);
end;
$$;

-- 2. A entrega ----------------------------------------------------------------
-- security definer: atendente e técnico entregam, mas não leem os_pecas_custo
-- nem gravam as colunas congeladas. Por isso a loja é conferida à mão.
-- A conta é a mesma de src/lib/orcamento.ts (Task 5); mudou uma, mude a outra.
create function public.entregar_os(os uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_os public.ordens_servico;
  v_orc public.os_orcamentos;
  v_subtotal numeric(12,2);
  v_desconto numeric(12,2);
  v_total numeric(12,2);
  v_custo numeric(12,2);
  v_pct numeric(5,2) := 0;
  v_comissao numeric(12,2);
  v_pago numeric(12,2);
  v_perfil public.perfil;
begin
  select * into v_os from ordens_servico o where o.id = entregar_os.os for update;
  if v_os.id is null
     or v_os.loja_id is distinct from public.minha_loja()
     or not public.loja_liberada(v_os.loja_id)
     or public.em_suporte() then
    raise exception 'OS não encontrada' using errcode = 'P0001';
  end if;
  if v_os.status in ('entregue', 'devolvido') then
    raise exception 'A OS já foi encerrada.' using errcode = 'P0001';
  end if;
  if v_os.status <> 'pronto' then
    raise exception 'A OS só pode ser entregue quando estiver pronta.' using errcode = 'P0001';
  end if;

  select * into v_orc from os_orcamentos
   where os_id = v_os.id and status = 'aprovado';
  if v_orc.id is null and not v_os.interna then
    raise exception 'A OS não tem orçamento aprovado.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from os_pecas p
     where p.os_id = v_os.id
       and not exists (select 1 from os_pecas_custo c where c.peca_id = p.id)) then
    raise exception 'O Dono precisa preencher o custo de todas as peças antes da entrega.'
      using errcode = 'P0001';
  end if;

  select coalesce(sum(i.quantidade * i.preco_unitario), 0) into v_subtotal
    from os_orcamento_itens i where i.orcamento_id = v_orc.id;
  v_subtotal := v_subtotal + coalesce(
    (select sum(p.quantidade * p.preco_unitario) from os_pecas p where p.os_id = v_os.id), 0);

  v_desconto := case
    when v_orc.desconto_valor is not null then v_orc.desconto_valor
    when v_orc.desconto_percentual is not null then round(v_subtotal * v_orc.desconto_percentual / 100, 2)
    else 0 end;
  v_desconto := least(greatest(v_desconto, 0), v_subtotal);
  v_total := v_subtotal - v_desconto;

  select coalesce(sum(p.quantidade * c.custo_unitario), 0) into v_custo
    from os_pecas p join os_pecas_custo c on c.peca_id = p.id
   where p.os_id = v_os.id;

  if v_os.tecnico_id is not null then
    select m.perfil into v_perfil from membros m where m.id = v_os.tecnico_id;
    if v_perfil = 'dono'
       and not coalesce((select dono_gera_comissao from config_loja where loja_id = v_os.loja_id), false) then
      v_pct := 0;
    else
      v_pct := coalesce((select percentual from comissoes_membro where membro_id = v_os.tecnico_id), 0);
    end if;
  end if;
  v_comissao := greatest(round((v_total - v_custo) * v_pct / 100, 2), 0);

  select coalesce(sum(valor), 0) into v_pago from os_pagamentos where os_id = v_os.id;
  if v_pago < v_total then
    raise exception 'Falta receber R$ % antes de entregar.',
      replace(to_char(v_total - v_pago, 'FM999999990.00'), '.', ',')
      using errcode = 'P0001';
  end if;
  if v_pago > v_total then
    raise exception 'Os pagamentos passam do total da OS. Corrija antes de entregar.'
      using errcode = 'P0001';
  end if;

  perform public.mudar_status_os(v_os.id, 'pronto', 'entregue');

  update ordens_servico
     set total_congelado = v_total,
         custo_pecas_congelado = v_custo,
         comissao_percentual_congelado = v_pct,
         comissao_congelada = v_comissao,
         lucro_congelado = v_total - v_custo - v_comissao,
         tecnico_congelado_id = v_os.tecnico_id
   where id = v_os.id;
end;
$$;

revoke all on function public.entregar_os(uuid) from public, anon, authenticated, service_role;
grant execute on function public.entregar_os(uuid) to authenticated;
