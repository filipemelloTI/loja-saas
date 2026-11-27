import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import type { Dependencias } from '@/lib/os'
import { ehTerminal, type StatusOS } from '@/lib/os-status'
import { erroDoBanco, primeiroErro, type Resultado } from '@/lib/resultado'
import type { Perfil } from '@/lib/tipos'
import { esquemaCustoPeca, esquemaPeca } from '@/lib/validacoes'

/**
 * Peças da OS lançadas à mão (spec 13.1: o Serviço funciona sem o módulo Estoque). Os três perfis
 * lançam; o custo fica em `os_pecas_custo`, que só o Dono lê e grava (a RLS garante; aqui só se evita
 * a ida ao banco e se fala português). Depois de enviado o orçamento, peça só muda com nova versão.
 */

export type Peca = {
  id: string
  descricao: string
  quantidade: number
  precoUnitario: number
  /** Só preenchido para o Dono. `null` para o Dono = custo pendente. */
  custoUnitario: number | null
}

export type DadosPecas = {
  pecas: Peca[]
  /** Quantas peças ainda não têm custo. Os outros perfis veem só este número, nunca o valor. */
  semCusto: number
}

export type DadosPeca = z.input<typeof esquemaPeca>

const ACESSO_NEGADO = { ok: false, erro: 'Acesso negado' } as const
const OK = { ok: true } as const
export const SO_DONO_CUSTO = 'Só o Dono lança o custo da peça.'

type Linha = Record<string, unknown>

/**
 * Peças da OS. O custo é lido só para o Dono; para os outros, a contagem de pendências vem de uma
 * função do banco que devolve apenas o número.
 */
export async function carregarPecasCom(supabase: SupabaseClient, osId: string, perfil: Perfil): Promise<DadosPecas> {
  const { data } = await supabase
    .from('os_pecas')
    .select('id, descricao, quantidade, preco_unitario')
    .eq('os_id', osId)
    .order('criado_em')
  const linhas = (data ?? []) as Linha[]
  if (!linhas.length) return { pecas: [], semCusto: 0 }

  let custos = new Map<string, number>()
  let semCusto = 0
  if (perfil === 'dono') {
    const { data: c } = await supabase
      .from('os_pecas_custo')
      .select('peca_id, custo_unitario')
      .in('peca_id', linhas.map((l) => l.id as string))
    custos = new Map(((c ?? []) as Linha[]).map((l) => [l.peca_id as string, Number(l.custo_unitario)]))
    semCusto = linhas.filter((l) => !custos.has(l.id as string)).length
  } else {
    const { data: n } = await supabase.rpc('pecas_sem_custo', { os: osId })
    semCusto = Number(n ?? 0)
  }

  return {
    pecas: linhas.map((l) => ({
      id: l.id as string,
      descricao: l.descricao as string,
      quantidade: l.quantidade as number,
      precoUnitario: Number(l.preco_unitario),
      custoUnitario: custos.get(l.id as string) ?? null,
    })),
    semCusto,
  }
}

export async function adicionarPecaCom(deps: Dependencias, osId: string, dados: DadosPeca): Promise<Resultado> {
  const lido = esquemaPeca.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  if (!osId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO

  const { data: os, error: falhaOS } = await deps.supabase
    .from('ordens_servico')
    .select('status')
    .eq('id', osId)
    .eq('loja_id', membro.lojaId)
    .maybeSingle()
  if (falhaOS) return erroDoBanco(falhaOS)
  if (!os) return { ok: false, erro: 'OS não encontrada' }
  if (ehTerminal(os.status as StatusOS)) return { ok: false, erro: 'A OS já foi encerrada.' }

  const v = lido.data
  const { error } = await deps.supabase.from('os_pecas').insert({
    loja_id: membro.lojaId,
    os_id: osId,
    descricao: v.descricao,
    quantidade: v.quantidade,
    preco_unitario: v.precoUnitario,
  })
  return error ? erroDoBanco(error) : OK
}

export async function removerPecaCom(deps: Dependencias, pecaId: string): Promise<Resultado> {
  if (!pecaId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO
  const { data, error } = await deps.supabase
    .from('os_pecas')
    .delete()
    .eq('id', pecaId)
    .eq('loja_id', membro.lojaId)
    .select('id')
  if (error) return erroDoBanco(error)
  return data?.length ? OK : { ok: false, erro: 'Peça não encontrada' }
}

/** Grava ou corrige o custo de uma peça. Só o Dono. */
export async function salvarCustoPecaCom(deps: Dependencias, pecaId: string, custoUnitario: number): Promise<Resultado> {
  const lido = esquemaCustoPeca.safeParse({ custoUnitario })
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  if (!pecaId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO
  if (membro.perfil !== 'dono') return { ok: false, erro: SO_DONO_CUSTO }

  const { error } = await deps.supabase
    .from('os_pecas_custo')
    .upsert(
      { peca_id: pecaId, loja_id: membro.lojaId, custo_unitario: lido.data.custoUnitario },
      { onConflict: 'peca_id' },
    )
  return error ? erroDoBanco(error) : OK
}
