'use server'

import { refresh } from 'next/cache'
import { abrirOSCom, mudarStatusCom, salvarLaudoCom, type DadosNovaOS, type Dependencias } from '@/lib/os'
import type { StatusOS } from '@/lib/os-status'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { Perfil } from '@/lib/tipos'

/**
 * Membro ativo e perfil conferidos no servidor pela sessão, nunca por dado vindo do cliente. O admin
 * em suporte não é membro, então nunca passa; loja suspensa também não (a RLS esconde o membro).
 */
async function dependencias(): Promise<Dependencias> {
  const supabase = await criarClienteServidor()
  return {
    membroDaSessao: async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return null
      const { data } = await supabase
        .from('membros')
        .select('loja_id, perfil')
        .eq('user_id', auth.user.id)
        .eq('ativo', true)
        .maybeSingle()
      return data ? { lojaId: data.loja_id as string, perfil: data.perfil as Perfil } : null
    },
    supabase,
  }
}

export async function abrirOS(dados: DadosNovaOS) {
  const r = await abrirOSCom(await dependencias(), dados)
  if (r.ok) refresh()
  return r
}

export async function mudarStatusOS(osId: string, para: StatusOS, observacao?: string) {
  const r = await mudarStatusCom(await dependencias(), osId, para, observacao)
  if (r.ok) refresh()
  return r
}

export async function salvarLaudo(osId: string, laudo: string) {
  const r = await salvarLaudoCom(await dependencias(), osId, laudo)
  if (r.ok) refresh()
  return r
}
