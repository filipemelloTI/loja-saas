-- Núcleo multi-loja: planos, lojas, membros, admin da plataforma,
-- acesso de suporte temporário, auditoria e isolamento por RLS.

-- Tipos ------------------------------------------------------------------
create type public.perfil as enum ('dono', 'tecnico', 'atendente');
create type public.modulo as enum ('servico', 'estoque', 'vendas', 'fornecedores', 'financeiro');
create type public.situacao_loja as enum ('em_dia', 'atrasado', 'suspensa');

-- Tabelas ----------------------------------------------------------------
create table public.planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  modulos public.modulo[] not null default '{}',
  limite_usuarios int not null check (limite_usuarios > 0)
);

create table public.lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  plano_id uuid not null references public.planos (id),
  modulos public.modulo[] not null default '{}',
  situacao public.situacao_loja not null default 'em_dia',
  criado_em timestamptz not null default now(),
  constraint vendas_exige_estoque
    check (not ('vendas' = any (modulos)) or 'estoque' = any (modulos))
);

create table public.membros (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nome text not null,
  perfil public.perfil not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index membros_loja_id_idx on public.membros (loja_id);

create table public.admins_plataforma (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.acessos_suporte (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas (id),
  concedido_por uuid not null default auth.uid() references auth.users (id),
  expira_em timestamptz not null,
  criado_em timestamptz not null default now()
);
create index acessos_suporte_loja_id_idx on public.acessos_suporte (loja_id);

-- Sem FK em loja_id/user_id: o histórico sobrevive à remoção do registro.
create table public.auditoria (
  id bigserial primary key,
  loja_id uuid,
  user_id uuid,
  acao text not null,
  tabela text not null,
  registro_id text,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);
create index auditoria_loja_id_idx on public.auditoria (loja_id, criado_em);

-- Funções de acesso (security definer: leem sem RLS, evitando recursão) --
create function public.sou_admin_plataforma()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from admins_plataforma where user_id = auth.uid());
$$;

-- Acesso de suporte vigente concedido a alguma loja (só conta para admin).
create function public.loja_em_suporte()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.loja_id
  from acessos_suporte s
  where public.sou_admin_plataforma() and s.expira_em > now()
  order by s.criado_em desc
  limit 1;
$$;

-- Admin agindo como loja via acesso de suporte (não é membro ativo).
create function public.em_suporte()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select not exists (select 1 from membros where user_id = auth.uid() and ativo)
     and public.loja_em_suporte() is not null;
$$;

create function public.minha_loja()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select loja_id from membros where user_id = auth.uid() and ativo),
    public.loja_em_suporte()
  );
$$;

-- Em suporte o admin é 'dono', mas as políticas de escrita exigem not em_suporte().
create function public.meu_perfil()
returns public.perfil
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select perfil from membros where user_id = auth.uid() and ativo),
    case when public.em_suporte() then 'dono'::public.perfil end
  );
$$;

create function public.loja_liberada(loja uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from lojas where id = loja and situacao <> 'suspensa');
$$;

-- Ignora RLS de propósito: o app precisa saber que a loja está suspensa.
create function public.situacao_da_minha_loja()
returns public.situacao_loja
language sql stable security definer
set search_path = public, pg_temp
as $$
  select situacao from lojas where id = public.minha_loja();
$$;

-- Auditoria --------------------------------------------------------------
create function public.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  linha jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into auditoria (loja_id, user_id, acao, tabela, registro_id, detalhes)
  values (
    case when tg_table_name = 'lojas' then (linha ->> 'id')::uuid
         else (linha ->> 'loja_id')::uuid end,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    linha ->> 'id',
    case tg_op
      when 'INSERT' then jsonb_build_object('depois', to_jsonb(new))
      when 'UPDATE' then jsonb_build_object('antes', to_jsonb(old), 'depois', to_jsonb(new))
      else jsonb_build_object('antes', to_jsonb(old))
    end
  );
  return null;
end;
$$;

create trigger auditoria_lojas after insert or update or delete on public.lojas
  for each row execute function public.registrar_auditoria();
create trigger auditoria_membros after insert or update or delete on public.membros
  for each row execute function public.registrar_auditoria();
create trigger auditoria_acessos_suporte after insert or update or delete on public.acessos_suporte
  for each row execute function public.registrar_auditoria();

-- Plano, módulos e situação: só o admin da plataforma, e não na loja que ele
-- está atendendo em suporte.
-- Papéis de servidor (postgres, service_role) não passam por esta regra.
create function public.proteger_campos_da_plataforma()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.plano_id, new.modulos, new.situacao)
         is distinct from (old.plano_id, old.modulos, old.situacao)
     and not (public.sou_admin_plataforma()
              and new.id is distinct from public.loja_em_suporte()) then
    raise exception 'Só o admin da plataforma altera plano, módulos e situação da loja'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_campos_da_plataforma before update on public.lojas
  for each row execute function public.proteger_campos_da_plataforma();

-- RLS --------------------------------------------------------------------
alter table public.planos enable row level security;
alter table public.lojas enable row level security;
alter table public.membros enable row level security;
alter table public.admins_plataforma enable row level security;
alter table public.acessos_suporte enable row level security;
alter table public.auditoria enable row level security;
-- admins_plataforma e auditoria: sem políticas (acesso só pelas funções acima).

-- planos
create policy planos_leitura on public.planos
  for select to authenticated using (true);
create policy planos_admin_escreve on public.planos
  for all to authenticated
  using (public.sou_admin_plataforma())
  with check (public.sou_admin_plataforma());

-- lojas
create policy lojas_leitura on public.lojas
  for select to authenticated
  using (
    public.sou_admin_plataforma()
    or (id = public.minha_loja() and public.loja_liberada(id))
  );
create policy lojas_dono_atualiza on public.lojas
  for update to authenticated
  using (
    id = public.minha_loja() and public.loja_liberada(id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    id = public.minha_loja() and public.loja_liberada(id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );
create policy lojas_admin_insere on public.lojas
  for insert to authenticated
  with check (public.sou_admin_plataforma());
-- Suporte é por loja: a loja sob suporte fica só leitura para o admin
-- (inclusive situação/plano) até o acesso expirar; as demais seguem editáveis.
create policy lojas_admin_atualiza on public.lojas
  for update to authenticated
  using (public.sou_admin_plataforma() and id is distinct from public.loja_em_suporte())
  with check (public.sou_admin_plataforma() and id is distinct from public.loja_em_suporte());

-- membros (uso por loja para o admin vem de função própria, Task 7)
create policy membros_leitura on public.membros
  for select to authenticated
  using (loja_id = public.minha_loja() and public.loja_liberada(loja_id));
create policy membros_dono_insere on public.membros
  for insert to authenticated
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );
create policy membros_dono_atualiza on public.membros
  for update to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );

-- acessos_suporte: o Dono libera/encerra; o admin vê quem liberou
create policy acessos_suporte_leitura on public.acessos_suporte
  for select to authenticated
  using (
    public.sou_admin_plataforma()
    or (loja_id = public.minha_loja() and public.loja_liberada(loja_id)
        and public.meu_perfil() = 'dono')
  );
create policy acessos_suporte_dono_insere on public.acessos_suporte
  for insert to authenticated
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
    and concedido_por = auth.uid()
  );
create policy acessos_suporte_dono_atualiza on public.acessos_suporte
  for update to authenticated
  using (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  )
  with check (
    loja_id = public.minha_loja() and public.loja_liberada(loja_id)
    and public.meu_perfil() = 'dono' and not public.em_suporte()
  );
