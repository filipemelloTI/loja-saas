-- Link público de acompanhamento da OS (spec 8.8): o cliente da loja vê o
-- andamento e responde ao orçamento pelo celular, sem login.
--
-- O visitante anônimo nunca lê tabela: só chama as duas funções abaixo, que
-- recebem o token, devolvem apenas o que pode ser mostrado e gravam a resposta.
-- Nada de CPF, senha do aparelho, custo, comissão, lucro ou observação interna.

alter table public.ordens_servico
  add column token_publico text not null unique
    default encode(extensions.gen_random_bytes(24), 'hex');

-- O cliente que aprova pelo link entra como meio "link".
alter table public.os_orcamentos drop constraint os_orcamentos_aprovado_meio_check;
alter table public.os_orcamentos add constraint os_orcamentos_aprovado_meio_check
  check (aprovado_meio in ('balcao', 'telefone', 'whatsapp', 'outro', 'link'));

-- Token: 48 caracteres hex. Formato errado nem consulta o banco.
create function public.token_publico_valido(token text)
returns boolean
language sql immutable
as $$ select token ~ '^[0-9a-f]{48}$' $$;

-- Leitura pública ---------------------------------------------------------------
create function public.acompanhamento_os(token text)
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
    'garantia', null);
end;
$$;

-- Resposta do cliente ---------------------------------------------------------
-- `orc` é o orçamento que a página mostrou: se a loja trocou de versão nesse meio
-- tempo, o cliente não aprova algo que não viu.
create function public.responder_orcamento_pelo_link(token text, orc uuid, aprova boolean, nome text default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_os public.ordens_servico;
  v_orc public.os_orcamentos;
  v_ultima int;
  v_nome text := nullif(trim(nome), '');
begin
  if not public.token_publico_valido(token) then
    raise exception 'Link não encontrado.' using errcode = 'P0001';
  end if;
  select * into v_os from ordens_servico o where o.token_publico = responder_orcamento_pelo_link.token for update;
  if v_os.id is null or not public.loja_liberada(v_os.loja_id) then
    raise exception 'Link não encontrado.' using errcode = 'P0001';
  end if;

  select * into v_orc from os_orcamentos o where o.id = orc and o.os_id = v_os.id for update;
  select max(versao) into v_ultima from os_orcamentos where os_id = v_os.id;
  if v_orc.id is null or v_orc.versao < v_ultima then
    raise exception 'O orçamento foi atualizado. Recarregue a página.' using errcode = 'P0001';
  end if;
  if v_orc.status in ('aprovado', 'recusado') then
    raise exception 'Este orçamento já foi respondido.' using errcode = 'P0001';
  end if;
  if v_orc.status <> 'enviado' or v_os.status <> 'orcamento_enviado' then
    raise exception 'O orçamento foi atualizado. Recarregue a página.' using errcode = 'P0001';
  end if;

  if aprova then
    if v_nome is null then
      raise exception 'Informe seu nome para aprovar.' using errcode = 'P0001';
    end if;
    if length(v_nome) > 80 then
      raise exception 'Nome: no máximo 80 caracteres.' using errcode = 'P0001';
    end if;
    perform public.mudar_status_os(v_os.id, 'orcamento_enviado', 'aprovado',
      format('Orçamento v%s aprovado pelo link por %s', v_orc.versao, v_nome));
    update os_orcamentos
       set status = 'aprovado', aprovado_por = v_nome, aprovado_meio = 'link', aprovado_em = now()
     where id = v_orc.id;
  else
    perform public.mudar_status_os(v_os.id, 'orcamento_enviado', 'recusado',
      format('Orçamento v%s recusado pelo link', v_orc.versao));
    update os_orcamentos set status = 'recusado', recusado_em = now() where id = v_orc.id;
  end if;
end;
$$;

revoke all on function public.acompanhamento_os(text) from public, anon, authenticated, service_role;
revoke all on function public.responder_orcamento_pelo_link(text, uuid, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.acompanhamento_os(text) to anon, authenticated;
grant execute on function public.responder_orcamento_pelo_link(text, uuid, boolean, text) to anon, authenticated;
