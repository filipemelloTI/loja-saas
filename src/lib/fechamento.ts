import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dependencias } from '@/lib/os'
import { erroDoBanco, type Resultado } from '@/lib/resultado'

/**
 * Entrega da OS e o fechamento que ela congela (spec 8.5). Toda a conferência (etapa, orçamento
 * aprovado, custo das peças, pagamento completo) e a conta são da função `entregar_os` do banco,
 * numa transação só; aqui só se chama e se fala português. O fechamento (custo, comissão, lucro) a
 * RLS só entrega ao Dono.
 */

export type Fechamento = {
  total: number
  custoPecas: number
  comissaoPercentual: number
  comissao: number
  lucro: number
  tecnicoId: string | null
  fechadoEm: string
}

export async function entregarOSCom(deps: Dependencias, osId: string): Promise<Resultado> {
  if (!osId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return { ok: false, erro: 'Acesso negado' }
  const { error } = await deps.supabase.rpc('entregar_os', { os: osId })
  return error ? erroDoBanco(error) : { ok: true }
}

/** Fechamento da OS entregue; `null` para quem não é Dono (a RLS não entrega a linha) ou se não houve entrega. */
export async function carregarFechamentoCom(supabase: SupabaseClient, osId: string): Promise<Fechamento | null> {
  const { data } = await supabase
    .from('os_fechamento')
    .select('total, custo_pecas, comissao_percentual, comissao, lucro, tecnico_id, fechado_em')
    .eq('os_id', osId)
    .maybeSingle()
  if (!data) return null
  return {
    total: Number(data.total),
    custoPecas: Number(data.custo_pecas),
    comissaoPercentual: Number(data.comissao_percentual),
    comissao: Number(data.comissao),
    lucro: Number(data.lucro),
    tecnicoId: (data.tecnico_id as string | null) ?? null,
    fechadoEm: data.fechado_em as string,
  }
}
