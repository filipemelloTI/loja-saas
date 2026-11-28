-- Garantia do serviço (spec 8.7).
--  * Prazo: ajuste na OS (só o Dono, antes da entrega) → senão o maior prazo dos
--    serviços do catálogo no orçamento aprovado → senão o padrão da loja.
--  * Conta da entrega e é congelado nela (`garantia_dias`).
--  * OS de garantia: aberta a partir de uma OS entregue e dentro do prazo, sem
--    orçamento nem cobrança, comissão zero. Ela não abre garantia nova (vale a
--    da original); OS interna não tem garantia (não tem cliente).

alter table public.ordens_servico
  add column garantia_ajuste_dias int check (garantia_ajuste_dias >= 0),
  add column garantia_dias int check (garantia_dias >= 0),
  add column garantia_de uuid,
  add constraint os_garantia_de_mesma_loja
    foreign key (garantia_de, loja_id) references public.ordens_servico (id, loja_id);

create function public.proteger_garantia_os()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.garantia_dias is not null or new.garantia_de is not null or new.garantia_ajuste_dias is not null then
      raise exception 'A garantia é definida pelo sistema' using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.garantia_dias, new.garantia_de) is distinct from (old.garantia_dias, old.garantia_de) then
    raise exception 'A garantia é definida pelo sistema' using errcode = '42501';
  end if;
  if new.garantia_ajuste_dias is distinct from old.garantia_ajuste_dias then
    if public.meu_perfil() is distinct from 'dono' then
      raise exception 'Só o Dono ajusta o prazo de garantia.' using errcode = 'P0001';
    end if;
    if old.status in ('entregue', 'devolvido') then
      raise exception 'A OS já foi encerrada.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger proteger_garantia_os before insert or update on public.ordens_servico
  for each row execute function public.proteger_garantia_os();

-- Prazo que a OS terá ao ser entregue. security invoker: quem chama só vê a própria loja.
create function public.garantia_prevista_os(os uuid)
returns int
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(
    o.garantia_ajuste_dias,
    (select max(s.garantia_dias)
       from os_orcamentos orc
       join os_orcamento_itens i on i.orcamento_id = orc.id
       join servicos s on s.id = i.servico_id
      where orc.os_id = o.id and orc.status = 'aprovado'),
    (select c.garantia_servico_dias from config_loja c where c.loja_id = o.loja_id))
  from ordens_servico o
  where o.id = garantia_prevista_os.os;
$$;

grant execute on function public.garantia_prevista_os(uuid) to authenticated;

-- Entrega: igual à do Plano 3, mais garantia e OS de garantia. -----------------
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
  v_de_garantia boolean;
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
  v_de_garantia := v_os.garantia_de is not null;

  select * into v_orc from os_orcamentos
   where os_id = v_os.id and status = 'aprovado';
  if v_orc.id is null and not v_os.interna and not v_de_garantia then
    raise exception 'A OS não tem orçamento aprovado.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from os_pecas p
     where p.os_id = v_os.id
       and not exists (select 1 from os_pecas_custo c where c.peca_id = p.id)) then
    raise exception 'O Dono precisa preencher o custo de todas as peças antes da entrega.'
      using errcode = 'P0001';
  end if;

  if v_de_garantia then
    -- Na garantia o cliente não paga: total e comissão zero.
    v_total := 0;
  else
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
  end if;

  select coalesce(sum(p.quantidade * c.custo_unitario), 0) into v_custo
    from os_pecas p join os_pecas_custo c on c.peca_id = p.id
   where p.os_id = v_os.id;

  if v_os.tecnico_id is not null and not v_de_garantia then
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
     set garantia_dias = case when v_os.interna or v_de_garantia then null
                              else public.garantia_prevista_os(v_os.id) end
   where id = v_os.id;

  insert into os_fechamento (os_id, loja_id, total, custo_pecas, comissao_percentual, comissao, lucro, tecnico_id)
  values (v_os.id, v_os.loja_id, v_total, v_custo, v_pct, v_comissao, v_total - v_custo - v_comissao, v_os.tecnico_id);
end;
$$;

-- Abrir OS de garantia ----------------------------------------------------------
create function public.abrir_os_garantia(os uuid, defeito text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_orig public.ordens_servico;
  v_vence date;
  v_defeito text := nullif(trim(defeito), '');
  v_nova uuid;
begin
  select * into v_orig from ordens_servico o where o.id = abrir_os_garantia.os;
  if v_orig.id is null
     or v_orig.loja_id is distinct from public.minha_loja()
     or not public.loja_liberada(v_orig.loja_id)
     or public.em_suporte() then
    raise exception 'OS não encontrada' using errcode = 'P0001';
  end if;
  if v_orig.status <> 'entregue' or v_orig.garantia_dias is null then
    raise exception 'Só dá para abrir garantia de OS entregue com garantia.' using errcode = 'P0001';
  end if;
  v_vence := (v_orig.encerrada_em at time zone 'America/Sao_Paulo')::date + v_orig.garantia_dias;
  if current_date > v_vence then
    raise exception 'A garantia desta OS venceu em %.', to_char(v_vence, 'DD/MM/YYYY') using errcode = 'P0001';
  end if;
  if v_defeito is null then
    raise exception 'Descreva o problema que voltou.' using errcode = 'P0001';
  end if;

  insert into ordens_servico (loja_id, cliente_id, interna, aparelho_tipo, marca, modelo, cor, imei,
                              defeito_relatado, tecnico_id, garantia_de, observacao)
  values (v_orig.loja_id, v_orig.cliente_id, false, v_orig.aparelho_tipo, v_orig.marca, v_orig.modelo,
          v_orig.cor, v_orig.imei, v_defeito, v_orig.tecnico_id, v_orig.id,
          format('Garantia da OS nº %s', v_orig.numero))
  returning id into v_nova;
  return v_nova;
end;
$$;

revoke all on function public.abrir_os_garantia(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.abrir_os_garantia(uuid, text) to authenticated;

-- O link público passa a mostrar a garantia da OS entregue. ----------------------
create or replace function public.garantia_publica_os(os_id uuid)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case when o.garantia_dias is null or o.status <> 'entregue' then null else jsonb_build_object(
    'dias', o.garantia_dias,
    'vence_em', (o.encerrada_em at time zone 'America/Sao_Paulo')::date + o.garantia_dias,
    'condicoes', coalesce((select jsonb_agg(c.texto order by c.ordem) from condicoes_garantia c
                           where c.loja_id = o.loja_id), '[]'::jsonb)) end
  from ordens_servico o where o.id = garantia_publica_os.os_id;
$$;

revoke all on function public.garantia_publica_os(uuid) from public, anon, authenticated, service_role;

-- Mesma leitura pública da migração anterior, agora com a garantia.
create or replace function public.acompanhamento_os(token text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_os public.ordens_servico;
  v_orc public.os_orcamentos;
  v_cfg public.config_loja;
  v_nome_loja text;
  v_cliente text;
begin
  if not public.token_publico_valido(token) then
    return null;
  end if;
  select * into v_os from ordens_servico o where o.token_publico = acompanhamento_os.token;
  if v_os.id is null or not public.loja_liberada(v_os.loja_id) then
    return null;
  end if;

  select nome into v_nome_loja from lojas where id = v_os.loja_id;
  select * into v_cfg from config_loja where loja_id = v_os.loja_id;
  select split_part(trim(nome), ' ', 1) into v_cliente from clientes where id = v_os.cliente_id;

  -- Só o orçamento que já saiu da loja: rascunho não aparece para o cliente.
  select * into v_orc from os_orcamentos
   where os_id = v_os.id and status in ('enviado', 'aprovado', 'recusado')
   order by versao desc limit 1;

  return jsonb_build_object(
    'loja', jsonb_build_object(
      'nome', v_nome_loja,
      'telefone', v_cfg.telefone,
      'endereco', v_cfg.endereco,
      'logo_path', v_cfg.logo_path),
    'cliente', v_cliente,
    'os', jsonb_build_object(
      'numero', v_os.numero,
      'aparelho_tipo', v_os.aparelho_tipo,
      'marca', v_os.marca,
      'modelo', v_os.modelo,
      'status', v_os.status,
      'criado_em', v_os.criado_em,
      'encerrada_em', v_os.encerrada_em,
      'previsao_entrega', v_os.previsao_entrega),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('para_status', h.para_status, 'criado_em', h.criado_em)
                       order by h.criado_em)
        from os_historico h where h.os_id = v_os.id), '[]'::jsonb),
    'orcamento', case when v_orc.id is null then null else jsonb_build_object(
      'id', v_orc.id,
      'versao', v_orc.versao,
      'status', v_orc.status,
      'desconto_valor', v_orc.desconto_valor,
      'desconto_percentual', v_orc.desconto_percentual,
      'aprovado_em', v_orc.aprovado_em,
      'recusado_em', v_orc.recusado_em,
      'itens', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'descricao', i.descricao, 'quantidade', i.quantidade, 'preco_unitario', i.preco_unitario)
               order by i.ordem, i.criado_em)
          from os_orcamento_itens i where i.orcamento_id = v_orc.id), '[]'::jsonb)) end,
    'pecas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'descricao', p.descricao, 'quantidade', p.quantidade, 'preco_unitario', p.preco_unitario)
             order by p.criado_em)
        from os_pecas p where p.os_id = v_os.id), '[]'::jsonb),
    'pago', coalesce((select sum(valor) from os_pagamentos where os_id = v_os.id), 0),
    'garantia', public.garantia_publica_os(v_os.id));
end;
$$;
