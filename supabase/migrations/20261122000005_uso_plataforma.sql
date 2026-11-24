-- Painel da plataforma: uso por loja (só números, nada de dados internos)
-- e desfazer uma loja recém-criada quando a criação falha no meio.

-- Uso por loja para o admin da plataforma. Security definer porque o admin
-- não lê membros nem auth.users pela RLS.
create function public.uso_lojas()
returns table (
  loja_id uuid,
  nome text,
  plano text,
  modulos public.modulo[],
  situacao public.situacao_loja,
  usuarios_ativos int,
  ultimo_acesso timestamptz
)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if not public.sou_admin_plataforma() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;

  return query
  select l.id, l.nome, p.nome, l.modulos, l.situacao,
         (select count(*)::int from membros m where m.loja_id = l.id and m.ativo),
         (select max(u.last_sign_in_at)
          from membros m join auth.users u on u.id = m.user_id
          where m.loja_id = l.id)
  from lojas l
  join planos p on p.id = l.plano_id
  order by l.nome;
end;
$$;

revoke execute on function public.uso_lojas() from public, anon;
grant execute on function public.uso_lojas() to authenticated;

-- Rollback do "criar loja": apaga a loja e os padrões semeados pelo trigger,
-- numa transação só. Recusa loja que já tem usuários (não é mais "nova").
-- Só o servidor (service role) chama.
create function public.desfazer_loja_nova(p_loja uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from membros where loja_id = p_loja) then
    raise exception 'A loja já tem usuários' using errcode = 'P0001';
  end if;
  delete from mensagens_padrao where loja_id = p_loja;
  delete from condicoes_garantia where loja_id = p_loja;
  delete from checklist_itens where loja_id = p_loja;
  delete from config_loja where loja_id = p_loja;
  delete from lojas where id = p_loja;
end;
$$;

revoke execute on function public.desfazer_loja_nova(uuid) from public, anon, authenticated;
grant execute on function public.desfazer_loja_nova(uuid) to service_role;
