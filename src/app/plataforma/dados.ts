import 'server-only'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { Plano } from './componentes'

/** Planos em ordem de nome (a RLS libera a leitura para usuários logados). */
export async function carregarPlanos(): Promise<Plano[]> {
  const supabase = await criarClienteServidor()
  const { data } = await supabase.from('planos').select('id, nome, modulos, limite_usuarios').order('nome')
  return (data ?? []) as Plano[]
}
