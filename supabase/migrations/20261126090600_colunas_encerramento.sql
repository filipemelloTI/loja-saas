-- Números da OS congelados na entrega (spec 8.5): total cobrado, custo das
-- peças, % e valor da comissão do técnico, e lucro. Depois de entregue, mudar a
-- % de comissão ou o custo de uma peça não altera a OS.
--
-- Só a função de entrega grava essas colunas. Ela roda com privilégio de
-- servidor (security definer), então aqui basta barrar os papéis de usuário,
-- no mesmo padrão de proteger_numero_os. Não usamos uma variável de sessão
-- como "chave": qualquer usuário logado consegue defini-la.

alter table public.ordens_servico
  add column total_congelado numeric(10,2),
  add column custo_pecas_congelado numeric(10,2),
  add column comissao_percentual_congelado numeric(5,2),
  add column comissao_congelada numeric(10,2),
  add column lucro_congelado numeric(10,2),
  add column tecnico_congelado_id uuid;

create function public.proteger_congelados_os()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.total_congelado, new.custo_pecas_congelado,
          new.comissao_percentual_congelado, new.comissao_congelada,
          new.lucro_congelado, new.tecnico_congelado_id)
         is distinct from
         (old.total_congelado, old.custo_pecas_congelado,
          old.comissao_percentual_congelado, old.comissao_congelada,
          old.lucro_congelado, old.tecnico_congelado_id) then
    raise exception 'Os valores de encerramento da OS só são gravados na entrega'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger proteger_congelados_os before update on public.ordens_servico
  for each row execute function public.proteger_congelados_os();

-- Na abertura também: ninguém cria uma OS já com números de encerramento.
create function public.os_nasce_sem_congelados()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.total_congelado, new.custo_pecas_congelado,
          new.comissao_percentual_congelado, new.comissao_congelada,
          new.lucro_congelado, new.tecnico_congelado_id)
         is distinct from (null::numeric, null::numeric, null::numeric,
                           null::numeric, null::numeric, null::uuid) then
    raise exception 'Os valores de encerramento da OS só são gravados na entrega'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger os_nasce_sem_congelados before insert on public.ordens_servico
  for each row execute function public.os_nasce_sem_congelados();
