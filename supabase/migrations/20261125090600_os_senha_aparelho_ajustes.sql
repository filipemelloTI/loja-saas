-- Ajustes de revisão em os_senha_aparelho (a migração 090500 já foi aplicada).

-- 1) Corrida com o encerramento. Sem trava, guardar_senha_aparelho lia o
-- status "aberto", a OS era entregue em outra transação (o gatilho apagava a
-- senha, que ainda não existia) e só então o insert da senha era confirmado:
-- sobrava uma senha numa OS encerrada. O KEY SHARE da FK não conflita com o
-- NO KEY UPDATE do update de status; FOR SHARE conflita, então as duas
-- transações se enfileiram: quem chega depois enxerga o estado final.
create or replace function public.guardar_senha_aparelho(os uuid, senha text)
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
    where o.id = os and o.loja_id = v_loja
    for share of o;
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

-- 4) O carimbo do encerramento é o do primeiro fechamento (base de contagem
-- de garantia): entregue -> entregue ou entregue -> devolvido não o move.
create or replace function public.encerrar_os_apaga_senha()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from os_senha_aparelho where os_id = new.id;
  update ordens_servico set encerrada_em = now()
  where id = new.id and encerrada_em is null;
  return null;
end;
$$;
