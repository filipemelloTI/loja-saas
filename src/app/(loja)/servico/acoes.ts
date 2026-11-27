'use server'

import { refresh } from 'next/cache'
import { abrirOSCom, mudarStatusCom, salvarLaudoCom, type DadosNovaOS, type Dependencias } from '@/lib/os'
import {
  adicionarItemCom,
  aprovarOrcamentoCom,
  enviarOrcamentoCom,
  novaVersaoCom,
  recusarOrcamentoCom,
  removerItemCom,
  salvarDescontoCom,
  type DadosAprovacao,
  type DadosDesconto,
  type DadosItem,
} from '@/lib/orcamento-acoes'
import { entregarOSCom } from '@/lib/fechamento'
import { registrarPagamentoCom, removerPagamentoCom, type DadosPagamento } from '@/lib/pagamento-acoes'
import { adicionarPecaCom, removerPecaCom, salvarCustoPecaCom, type DadosPeca } from '@/lib/pecas-acoes'
import type { Resultado } from '@/lib/resultado'
import type { StatusOS } from '@/lib/os-status'
import { exigirArea } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { Perfil } from '@/lib/tipos'

/**
 * Módulo liberado + membro ativo e perfil conferidos no servidor pela sessão, nunca por dado vindo
 * do cliente. `exigirArea` redireciona para `/` quando a loja não tem o módulo (Server Actions
 * seguem esse `redirect` com 303 — a gravação nunca acontece). O admin em suporte não é membro,
 * então nunca passa; loja suspensa também não (a RLS esconde o membro).
 */
async function dependencias(): Promise<Dependencias> {
  await exigirArea('servico')
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

// Orçamento ------------------------------------------------------------------

async function comRefresh(r: Promise<Resultado>) {
  const resultado = await r
  if (resultado.ok) refresh()
  return resultado
}

export async function adicionarItemOrcamento(osId: string, dados: DadosItem) {
  return comRefresh(adicionarItemCom(await dependencias(), osId, dados))
}

export async function removerItemOrcamento(itemId: string) {
  return comRefresh(removerItemCom(await dependencias(), itemId))
}

export async function salvarDescontoOrcamento(orcamentoId: string, dados: DadosDesconto) {
  return comRefresh(salvarDescontoCom(await dependencias(), orcamentoId, dados))
}

export async function enviarOrcamento(orcamentoId: string) {
  return comRefresh(enviarOrcamentoCom(await dependencias(), orcamentoId))
}

export async function aprovarOrcamento(orcamentoId: string, dados: DadosAprovacao) {
  return comRefresh(aprovarOrcamentoCom(await dependencias(), orcamentoId, dados))
}

export async function recusarOrcamento(orcamentoId: string) {
  return comRefresh(recusarOrcamentoCom(await dependencias(), orcamentoId))
}

export async function novaVersaoOrcamento(orcamentoId: string) {
  return comRefresh(novaVersaoCom(await dependencias(), orcamentoId))
}

// Peças ----------------------------------------------------------------------

export async function adicionarPeca(osId: string, dados: DadosPeca) {
  return comRefresh(adicionarPecaCom(await dependencias(), osId, dados))
}

export async function removerPeca(pecaId: string) {
  return comRefresh(removerPecaCom(await dependencias(), pecaId))
}

export async function salvarCustoPeca(pecaId: string, custoUnitario: number) {
  return comRefresh(salvarCustoPecaCom(await dependencias(), pecaId, custoUnitario))
}

// Pagamento ------------------------------------------------------------------

export async function registrarPagamento(osId: string, dados: DadosPagamento) {
  return comRefresh(registrarPagamentoCom(await dependencias(), osId, dados))
}

export async function removerPagamento(pagamentoId: string) {
  return comRefresh(removerPagamentoCom(await dependencias(), pagamentoId))
}

// Entrega --------------------------------------------------------------------

export async function entregarOS(osId: string) {
  return comRefresh(entregarOSCom(await dependencias(), osId))
}
