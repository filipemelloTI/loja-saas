import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import { formatarReais } from '@/lib/dinheiro'
import { calcularTotalOrcamento } from '@/lib/orcamento'
import { carregarOrcamentoCom } from '@/lib/orcamento-acoes'
import type { Dependencias } from '@/lib/os'
import { ehTerminal, type StatusOS } from '@/lib/os-status'
import { erroDoBanco, primeiroErro, type Resultado } from '@/lib/resultado'
import { esquemaPagamento } from '@/lib/validacoes'

/**
 * Pagamentos da OS (spec 8.6): uma linha por forma usada. Antes de a OS ficar pronta, o que entra é
 * sinal; com a OS pronta, é pagamento final. A soma nunca passa do total do orçamento. As formas
 * aceitas, a trava de OS encerrada e "só o Dono corrige" estão no banco; aqui se confere o teto e se
 * fala português.
 */

export type TipoPagamento = 'sinal' | 'final'

export type Pagamento = {
  id: string
  tipo: TipoPagamento
  forma: string
  parcelas: number | null
  valor: number
  registradoEm: string
}

export type DadosPagamento = z.input<typeof esquemaPagamento>

const ACESSO_NEGADO = { ok: false, erro: 'Acesso negado' } as const
const OK = { ok: true } as const
export const SO_DONO_PAGAMENTO = 'Só o Dono corrige um pagamento já lançado.'
export const SEM_ORCAMENTO = 'Monte o orçamento antes de registrar pagamento.'

const centavos = (reais: number) => Math.round(reais * 100)

export async function carregarPagamentosCom(supabase: SupabaseClient, osId: string): Promise<Pagamento[]> {
  const { data } = await supabase
    .from('os_pagamentos')
    .select('id, tipo, forma, parcelas, valor, registrado_em')
    .eq('os_id', osId)
    .order('registrado_em')
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: p.id as string,
    tipo: p.tipo as TipoPagamento,
    forma: p.forma as string,
    parcelas: (p.parcelas as number | null) ?? null,
    valor: Number(p.valor),
    registradoEm: p.registrado_em as string,
  }))
}

/** Total cobrado da OS hoje: itens do orçamento atual + peças − desconto. Zero sem orçamento. */
export async function totalDaOSCom(supabase: SupabaseClient, osId: string): Promise<number> {
  const { atual, pecas } = await carregarOrcamentoCom(supabase, osId)
  if (!atual || atual.status === 'recusado') return 0
  return calcularTotalOrcamento({
    itens: atual.itens,
    pecas,
    descontoValor: atual.descontoValor,
    descontoPercentual: atual.descontoPercentual,
  }).total
}

export async function registrarPagamentoCom(deps: Dependencias, osId: string, dados: DadosPagamento): Promise<Resultado> {
  const lido = esquemaPagamento.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  if (!osId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO
  const { supabase } = deps

  const { data: os, error: falhaOS } = await supabase
    .from('ordens_servico')
    .select('status')
    .eq('id', osId)
    .eq('loja_id', membro.lojaId)
    .maybeSingle()
  if (falhaOS) return erroDoBanco(falhaOS)
  if (!os) return { ok: false, erro: 'OS não encontrada' }
  const status = os.status as StatusOS
  if (ehTerminal(status)) return { ok: false, erro: 'A OS já foi encerrada.' }

  const [total, pagos] = await Promise.all([totalDaOSCom(supabase, osId), carregarPagamentosCom(supabase, osId)])
  if (total <= 0) return { ok: false, erro: SEM_ORCAMENTO }
  const pago = pagos.reduce((t, p) => t + centavos(p.valor), 0)
  const falta = centavos(total) - pago
  if (centavos(lido.data.valor) > falta) {
    return {
      ok: false,
      erro:
        falta <= 0
          ? 'Esta OS já está paga.'
          : `O total pago não pode passar de ${formatarReais(total)}. Falta ${formatarReais(falta / 100)}.`,
    }
  }

  const v = lido.data
  const { error } = await supabase.from('os_pagamentos').insert({
    loja_id: membro.lojaId,
    os_id: osId,
    tipo: status === 'pronto' ? 'final' : 'sinal',
    forma: v.forma,
    parcelas: v.forma === 'credito' ? v.parcelas : null,
    valor: v.valor,
  })
  return error ? erroDoBanco(error) : OK
}

export async function removerPagamentoCom(deps: Dependencias, pagamentoId: string): Promise<Resultado> {
  if (!pagamentoId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO
  if (membro.perfil !== 'dono') return { ok: false, erro: SO_DONO_PAGAMENTO }
  const { data, error } = await deps.supabase
    .from('os_pagamentos')
    .delete()
    .eq('id', pagamentoId)
    .eq('loja_id', membro.lojaId)
    .select('id')
  if (error) return erroDoBanco(error)
  return data?.length ? OK : { ok: false, erro: 'Pagamento não encontrado' }
}
