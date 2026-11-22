import type { SupabaseClient } from '@supabase/supabase-js'
import type { Perfil, Modulo } from '@/lib/tipos'

export type Contexto = {
  userId: string
  adminPlataforma: boolean
  membro: { id: string; nome: string; perfil: Perfil; ativo: boolean } | null
  loja: {
    id: string
    nome: string
    modulos: Modulo[]
    situacao: 'em_dia' | 'atrasado' | 'suspensa'
  } | null
  emSuporte: boolean
}

/** Carrega o contexto a partir de um cliente Supabase já autenticado (respeita RLS). */
export async function carregarContextoCom(supabase: SupabaseClient): Promise<Contexto | null> {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return null

  const [admin, suporte, lojaId, situacao] = await Promise.all([
    supabase.rpc('sou_admin_plataforma'),
    supabase.rpc('em_suporte'),
    supabase.rpc('minha_loja'),
    supabase.rpc('situacao_da_minha_loja'),
  ])
  const adminPlataforma = admin.data === true
  const emSuporte = adminPlataforma && suporte.data === true

  const { data: m } = await supabase
    .from('membros')
    .select('id, nome, perfil, ativo')
    .eq('user_id', user.id)
    .maybeSingle()
  const membro = m ? { id: m.id, nome: m.nome, perfil: m.perfil as Perfil, ativo: m.ativo } : null

  let loja: Contexto['loja'] = null
  if (lojaId.data && situacao.data) {
    const { data: l } = await supabase
      .from('lojas')
      .select('id, nome, modulos')
      .eq('id', lojaId.data)
      .maybeSingle()
    // Suspensa: a RLS esconde a linha; mantemos só id e situação.
    loja = {
      id: lojaId.data as string,
      nome: l?.nome ?? '',
      modulos: (l?.modulos ?? []) as Modulo[],
      situacao: situacao.data as 'em_dia' | 'atrasado' | 'suspensa',
    }
  }

  return { userId: user.id, adminPlataforma, membro, loja, emSuporte }
}

export async function carregarContexto(): Promise<Contexto | null> {
  const { criarClienteServidor } = await import('@/lib/supabase/servidor')
  return carregarContextoCom(await criarClienteServidor())
}
