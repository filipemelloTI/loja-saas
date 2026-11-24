-- Configurações da loja: dados e padrões, catálogo de serviços (custo em
-- tabela separada), listas editáveis, mensagens padrão, comissão por membro,
-- limite de usuários do plano e proteção do último Dono.

-- Chaves compostas: custo e comissão sempre na mesma loja do registro pai.
alter table public.membros add constraint membros_id_loja_unique unique (id, loja_id);

-- Tabelas ----------------------------------------------------------------
create table public.config_loja (
  loja_id uuid primary key references public.lojas (id),
  cnpj text,
  endereco text,
  telefone text,
  logo_path text,
  texto_termos text,
  garantia_servico_dias int not null default 90 check (garantia_servico_dias >= 0),
  garantia_novo_dias int not null default 365 check (garantia_novo_dias >= 0),
  garantia_seminovo_dias int not null default 90 check (garantia_seminovo_dias >= 0),
  garantia_acessorio_dias int not null default 90 check (garantia_acessorio_dias >= 0),
  orcamento_alerta_dias int not null default 3 check (orcamento_alerta_dias >= 0),
  taxa_avaliacao_ativa boolean not null default false,
  taxa_avaliacao_valor numeric(10,2) not null default 0 check (taxa_avaliacao_valor >= 0),
  os_numero_inicial int not null default 1 check (os_numero_inicial >= 1),
  venda_numero_inicial int not null default 1 check (venda_numero_inicial >= 1),
  formas_pagamento text[] not null default '{pix,dinheiro,debito,credito}',
  dono_gera_comissao boolean not null default false,
  tecnico_ve_propria_comissao boolean not null default false
);

create table public.comissoes_membro (
  membro_id uuid primary key,
  loja_id uuid not null references public.lojas (id),
  percentual numeric(5,2) not null check (percentual between 0 and 100),
  foreign key (membro_id, loja_id) references public.membros (id, loja_id) on delete cascade
);
create index comissoes_membro_loja_id_idx on public.comissoes_membro (loja_id);

create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  nome text not null,
  preco numeric(10,2) not null check (preco >= 0),
  garantia_dias int check (garantia_dias >= 0),
  ativo boolean not null default true,
  unique (id, loja_id)
);
create index servicos_loja_id_idx on public.servicos (loja_id);

create table public.servicos_custo (
  servico_id uuid primary key,
  loja_id uuid not null references public.lojas (id),
  custo_peca_estimado numeric(10,2) not null check (custo_peca_estimado >= 0),
  foreign key (servico_id, loja_id) references public.servicos (id, loja_id) on delete cascade
);
create index servicos_custo_loja_id_idx on public.servicos_custo (loja_id);

create table public.checklist_itens (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true
);
create index checklist_itens_loja_id_idx on public.checklist_itens (loja_id, ordem);

create table public.condicoes_garantia (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  texto text not null,
  ordem int not null default 0
);
create index condicoes_garantia_loja_id_idx on public.condicoes_garantia (loja_id, ordem);

create table public.mensagens_padrao (
  loja_id uuid not null references public.lojas (id),
  evento text not null check (evento in ('os_aberta', 'orcamento_enviado', 'aguardando_peca',
                                         'pronto', 'entregue', 'devolvido', 'venda_concluida')),
  texto text not null,
  primary key (loja_id, evento)
);

-- Padrões de toda loja nova (security definer: roda para admin/service role).
create function public.semear_loja()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into config_loja (loja_id) values (new.id);

  insert into checklist_itens (loja_id, nome, ordem)
  select new.id, nome, ordem
  from unnest(array[
    'Tela trincada', 'Amassado ou riscado', 'Sinais de umidade', 'Botões', 'Câmera',
    'Face ID / biometria', 'Carregamento', 'Som e microfone', 'Liga normalmente'
  ]) with ordinality as t (nome, ordem);

  insert into condicoes_garantia (loja_id, texto, ordem)
  select new.id, texto, ordem
  from unnest(array[
    'Queda ou impacto', 'Contato com líquidos', 'Lacre de garantia rompido',
    'Aparelho aberto por terceiros'
  ]) with ordinality as t (texto, ordem);

  insert into mensagens_padrao (loja_id, evento, texto) values
    (new.id, 'os_aberta', 'Olá {cliente}! Recebemos seu {aparelho} na {loja}. OS nº {numero_os}. Acompanhe por aqui: {link}'),
    (new.id, 'orcamento_enviado', 'Olá {cliente}! O orçamento do seu {aparelho} ficou em {valor}. Para aprovar ou recusar: {link}'),
    (new.id, 'aguardando_peca', 'Olá {cliente}! Estamos aguardando a peça para o reparo do seu {aparelho}. Avisaremos assim que chegar. {link}'),
    (new.id, 'pronto', 'Olá {cliente}! Seu {aparelho} está pronto para retirada na {loja}. {link}'),
    (new.id, 'entregue', 'Obrigado, {cliente}! Seu {aparelho} foi entregue com garantia de {prazo_garantia} para {servico}. Termo e detalhes: {link}'),
    (new.id, 'devolvido', 'Olá {cliente}! Seu {aparelho} foi devolvido. Qualquer dúvida, fale com a {loja}.'),
    (new.id, 'venda_concluida', 'Obrigado pela compra, {cliente}! Seu {aparelho} tem garantia de {prazo_garantia}. Detalhes: {link}');

  return null;
end;
$$;

create trigger semear_loja after insert on public.lojas
  for each row execute function public.semear_loja();

-- Limite de usuários: conta só ativos; entrar ativo ou reativar conta.
-- Trava a linha da loja para duas inclusões simultâneas não furarem o limite.
create function public.verificar_limite_usuarios()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  limite int;
begin
  if not new.ativo
     or (tg_op = 'UPDATE' and old.ativo and old.loja_id = new.loja_id) then
    return new;
  end if;

  select p.limite_usuarios into limite
  from lojas l join planos p on p.id = l.plano_id
  where l.id = new.loja_id
  for update of l;

  if (select count(*) from membros
      where loja_id = new.loja_id and ativo and id <> new.id) >= limite then
    raise exception 'Limite de usuários do plano atingido' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger verificar_limite_usuarios before insert or update on public.membros
  for each row execute function public.verificar_limite_usuarios();

-- A loja nunca fica sem Dono ativo (desativar, trocar perfil, mudar de loja
-- ou apagar o último).
create function public.proteger_ultimo_dono()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if old.perfil = 'dono' and old.ativo
     and (tg_op = 'DELETE' or not new.ativo or new.perfil <> 'dono'
          or new.loja_id <> old.loja_id) then
    perform 1 from lojas where id = old.loja_id for update;
    if not exists (select 1 from membros
                   where loja_id = old.loja_id and perfil = 'dono' and ativo
                     and id <> old.id) then
      raise exception 'A loja precisa de pelo menos um dono ativo' using errcode = 'P0001';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger proteger_ultimo_dono before update or delete on public.membros
  for each row execute function public.proteger_ultimo_dono();

-- Auditoria --------------------------------------------------------------
create trigger auditoria_config_loja after insert or update or delete on public.config_loja
  for each row execute function public.registrar_auditoria();
create trigger auditoria_comissoes_membro after insert or update or delete on public.comissoes_membro
  for each row execute function public.registrar_auditoria();
create trigger auditoria_servicos after insert or update or delete on public.servicos
  for each row execute function public.registrar_auditoria();
create trigger auditoria_servicos_custo after insert or update or delete on public.servicos_custo
  for each row execute function public.registrar_auditoria();
create trigger auditoria_checklist_itens after insert or update or delete on public.checklist_itens
  for each row execute function public.registrar_auditoria();
create trigger auditoria_condicoes_garantia after insert or update or delete on public.condicoes_garantia
  for each row execute function public.registrar_auditoria();
create trigger auditoria_mensagens_padrao after insert or update or delete on public.mensagens_padrao
  for each row execute function public.registrar_auditoria();

-- RLS --------------------------------------------------------------------
-- Leitura: toda a loja (exceto custo e comissão, só Dono; admin em suporte
-- lê como Dono). Escrita: só Dono, nunca o admin em suporte.
-- As políticas "for all" de escrita também dão leitura, mas só ao Dono.
alter table public.config_loja enable row level security;
alter table public.comissoes_membro enable row level security;
alter table public.servicos enable row level security;
alter table public.servicos_custo enable row level security;
alter table public.checklist_itens enable row level security;
alter table public.condicoes_garantia enable row level security;
alter table public.mensagens_padrao enable row level security;

-- config_loja: criada pelo trigger, nunca apagada pelo app; Dono só atualiza.
create policy config_loja_leitura on public.config_loja
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy config_loja_dono_atualiza on public.config_loja
  for update to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );

-- comissoes_membro: só Dono
create policy comissoes_membro_dono_leitura on public.comissoes_membro
  for select to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono'
  );
create policy comissoes_membro_dono_escreve on public.comissoes_membro
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );

-- servicos
create policy servicos_leitura on public.servicos
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy servicos_dono_escreve on public.servicos
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );

-- servicos_custo: só Dono
create policy servicos_custo_dono_leitura on public.servicos_custo
  for select to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono'
  );
create policy servicos_custo_dono_escreve on public.servicos_custo
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );

-- checklist_itens
create policy checklist_itens_leitura on public.checklist_itens
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy checklist_itens_dono_escreve on public.checklist_itens
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );

-- condicoes_garantia
create policy condicoes_garantia_leitura on public.condicoes_garantia
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy condicoes_garantia_dono_escreve on public.condicoes_garantia
  for all to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );

-- mensagens_padrao: os 7 eventos vêm do trigger; Dono só edita o texto.
create policy mensagens_padrao_leitura on public.mensagens_padrao
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy mensagens_padrao_dono_atualiza on public.mensagens_padrao
  for update to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );
