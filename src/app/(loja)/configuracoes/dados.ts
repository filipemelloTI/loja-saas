import 'server-only'
import { exigirArea } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'

/**
 * Base de toda página de Configurações: confere de novo a área (o layout já protege,
 * mas a página pode renderizar sozinha) e devolve o cliente da sessão, que lê pela RLS.
 * Em suporte o admin vê tudo como Dono, mas só leitura.
 */
export async function carregarBase() {
  const ctx = await exigirArea('configuracoes')
  const supabase = await criarClienteServidor()
  return { supabase, lojaId: ctx.loja!.id, nomeLoja: ctx.loja!.nome, somenteLeitura: ctx.emSuporte }
}
