'use server'

import { refresh } from 'next/cache'
import { salvarClienteCom, type DadosCliente, type Dependencias } from '@/lib/clientes'
import { exigirArea } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'

/**
 * Módulo liberado + membro ativo conferidos no servidor pela sessão, nunca por dado vindo do cliente.
 * `exigirArea` redireciona para `/` quando a loja não tem o módulo (Server Actions seguem
 * esse `redirect` com 303 — a gravação nunca acontece). O admin em suporte não é membro,
 * então nunca passa; loja suspensa também não (a RLS esconde o membro).
 */
async function dependencias(): Promise<Dependencias> {
  await exigirArea('clientes')
  const supabase = await criarClienteServidor()
  return {
    membroDaSessao: async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return null
      const { data } = await supabase
        .from('membros')
        .select('loja_id')
        .eq('user_id', auth.user.id)
        .eq('ativo', true)
        .maybeSingle()
      return data ? { lojaId: data.loja_id as string } : null
    },
    supabase,
  }
}

export async function salvarCliente(dados: DadosCliente, id?: string) {
  const r = await salvarClienteCom(await dependencias(), dados, id)
  if (r.ok) refresh()
  return r
}
