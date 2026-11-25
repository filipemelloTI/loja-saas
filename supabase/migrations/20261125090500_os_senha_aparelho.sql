-- Senha (ou padrão) de desbloqueio do aparelho, anotada na entrada para o
-- técnico poder testar. É um segredo pessoal do cliente: só dono e técnico
-- da loja leem, só enquanto a OS está aberta, nunca o suporte da plataforma,
-- e fica cifrada no banco. Some quando a OS é entregue ou devolvida.
create extension if not exists pgcrypto with schema extensions;

-- Chave de cifragem -------------------------------------------------------
-- Vive no Supabase Vault (nunca no código nem na migração). É sorteada aqui,
-- uma vez por ambiente: cada banco tem a sua. Como a senha é efêmera, perder
-- a chave só inutiliza senhas de OS abertas, que o cliente pode informar de novo.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'senha_aparelho_chave') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'senha_aparelho_chave',
      'Chave de cifragem das senhas de aparelho (os_senha_aparelho)');
  end if;
end;
$$;

-- Devolve a chave. Só as funções abaixo (security definer, dono postgres)
-- conseguem chamá-la: ninguém mais tem EXECUTE, nem a chave de serviço.
create function public.chave_senha_aparelho()
returns text
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_chave text;
begin
  select decrypted_secret into v_chave
  from vault.decrypted_secrets
  where name = 'senha_aparelho_chave';
  if v_chave is null then
    raise exception 'chave de cifragem da senha do aparelho ausente do Vault';
  end if;
  return v_chave;
end;
$$;
revoke all on function public.chave_senha_aparelho()
  from public, anon, authenticated, service_role;

-- Tabela ------------------------------------------------------------------
create table public.os_senha_aparelho (
  os_id uuid primary key,
  loja_id uuid not null references public.lojas (id),
  senha_cifrada bytea not null,
  criado_em timestamptz not null default now(),
  foreign key (os_id, loja_id)
    references public.ordens_servico (id, loja_id) on delete cascade
);

-- RLS ligada e NENHUMA política: defesa em profundidade. Mas a ausência de
-- política não é recusa: o SELECT voltaria vazio e o INSERT/UPDATE/DELETE
-- "passariam" sem afetar linha alguma, em silêncio. O revoke é que transforma
-- o acesso direto em erro explícito (42501). NÃO REMOVER: o único caminho
-- para esta tabela são as duas funções abaixo. service_role entra no revoke
-- de propósito: a chave de serviço da plataforma também não lê a senha.
alter table public.os_senha_aparelho enable row level security;
revoke all on public.os_senha_aparelho from authenticated, anon, service_role;

-- Guardar -----------------------------------------------------------------
-- Qualquer membro da loja registra (o atendente anota na entrada, mesmo sem
-- poder ler depois). Todas as recusas levantam o MESMO erro: não distinguem
-- OS inexistente de OS de outra loja. Senha nula ou vazia remove a anotação.
create function public.guardar_senha_aparelho(os uuid, senha text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_loja uuid := public.minha_loja();
  v_status public.status_os;
begin
  if v_loja is not null
     and public.meu_perfil() is not null
     and not public.em_suporte()
     and public.loja_liberada(v_loja) then
    select o.status into v_status
    from ordens_servico o
    where o.id = os and o.loja_id = v_loja;
  end if;

  if v_status is null or v_status in ('entregue', 'devolvido') then
    raise exception 'sem permissão para guardar a senha'
      using errcode = '42501';
  end if;

  if senha is null or senha = '' then
    delete from os_senha_aparelho where os_id = os;
    return;
  end if;

  insert into os_senha_aparelho (os_id, loja_id, senha_cifrada)
  values (os, v_loja,
          extensions.pgp_sym_encrypt(senha, public.chave_senha_aparelho()))
  on conflict (os_id) do update
    set senha_cifrada = excluded.senha_cifrada, criado_em = now();
end;
$$;

-- Ler ---------------------------------------------------------------------
-- Devolve null (nunca erro) em todo caso negado, para não servir de oráculo
-- sobre a existência de uma OS: outra loja, atendente, suporte, loja suspensa,
-- OS encerrada, OS inexistente ou sem senha dão a mesma resposta.
create function public.senha_aparelho(os uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select extensions.pgp_sym_decrypt(s.senha_cifrada, public.chave_senha_aparelho())
  from os_senha_aparelho s
  join ordens_servico o on o.id = s.os_id and o.loja_id = s.loja_id
  where s.os_id = os
    and s.loja_id = public.minha_loja()
    and public.loja_liberada(s.loja_id)
    and public.meu_perfil() in ('dono', 'tecnico')
    and not public.em_suporte()
    and o.status not in ('entregue', 'devolvido');
$$;

revoke all on function public.guardar_senha_aparelho(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.senha_aparelho(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.guardar_senha_aparelho(uuid, text) to authenticated;
grant execute on function public.senha_aparelho(uuid) to authenticated;

-- Encerramento ------------------------------------------------------------
-- Ao entregar ou devolver, apaga a senha e carimba o encerramento. Security
-- definer porque quem muda o status não tem privilégio na tabela da senha.
-- O update de encerrada_em não refaz o gatilho (ele só escuta a coluna status).
create function public.encerrar_os_apaga_senha()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from os_senha_aparelho where os_id = new.id;
  update ordens_servico set encerrada_em = now() where id = new.id;
  return null;
end;
$$;
revoke all on function public.encerrar_os_apaga_senha()
  from public, anon, authenticated, service_role;

create trigger os_encerrada_apaga_senha
  after update of status on public.ordens_servico
  for each row
  when (new.status in ('entregue', 'devolvido'))
  execute function public.encerrar_os_apaga_senha();
