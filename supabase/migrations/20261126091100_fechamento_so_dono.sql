-- Os números congelados na entrega (custo das peças, comissão, lucro) estavam
-- em colunas de ordens_servico, que os três perfis leem. A tela não mostraria,
-- mas a API entregaria o lucro ao atendente. A spec (8.5) diz: só o Dono vê.
-- Eles passam para uma tabela própria, no padrão de os_pecas_custo: só o Dono
-- lê, ninguém grava pela API, só a entregar_os (security definer).

create table public.os_fechamento (
  os_id uuid primary key,
  loja_id uuid not null references public.lojas (id),
  total numeric(10,2) not null,
  custo_pecas numeric(10,2) not null,
  comissao_percentual numeric(5,2) not null,
  comissao numeric(10,2) not null,
  lucro numeric(10,2) not null,
  tecnico_id uuid,
  fechado_em timestamptz not null default now(),
  foreign key (os_id, loja_id) references public.ordens_servico (id, loja_id)
);
create index os_fechamento_loja_idx on public.os_fechamento (loja_id);

alter table public.os_fechamento enable row level security;
revoke insert, update, delete on public.os_fechamento from authenticated, anon;

create policy os_fechamento_dono_leitura on public.os_fechamento
  for select to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono');

-- Sai o que a Task 4 tinha posto na OS.
drop trigger proteger_congelados_os on public.ordens_servico;
drop trigger os_nasce_sem_congelados on public.ordens_servico;
drop function public.proteger_congelados_os();
drop function public.os_nasce_sem_congelados();
alter table public.ordens_servico
  drop column total_congelado,
  drop column custo_pecas_congelado,
  drop column comissao_percentual_congelado,
  drop column comissao_congelada,
  drop column lucro_congelado,
  drop column tecnico_congelado_id;

-- A entrega grava o fechamento em vez das colunas. Resto idêntico.
create or replace function public.entregar_os(os uuid)
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

  insert into os_fechamento (os_id, loja_id, total, custo_pecas, comissao_percentual, comissao, lucro, tecnico_id)
  values (v_os.id, v_os.loja_id, v_total, v_custo, v_pct, v_comissao, v_total - v_custo - v_comissao, v_os.tecnico_id);
end;
$$;
