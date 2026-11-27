import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import type { Dependencias } from '@/lib/os'
import { ehTerminal, type StatusOS } from '@/lib/os-status'
import { erroDoBanco, FALHA_SALVAR, primeiroErro, type Resultado } from '@/lib/resultado'
import { esquemaAprovacao, esquemaDesconto, esquemaItemOrcamento } from '@/lib/validacoes'

/**
 * Ações do orçamento da OS, com as dependências injetadas para teste (mesmo padrão de `lib/os.ts`).
 * Itens e desconto são gravados direto pelo cliente da sessão; enviar, aprovar, recusar e criar nova
 * versão são funções do banco, que mudam o orçamento e a etapa da OS na mesma transação. As travas
 * (só rascunho muda, só a própria loja) estão no banco; aqui só se poupa a ida e se fala português.
 */

export type StatusOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'substituido'
export type MeioAprovacao = z.infer<typeof esquemaAprovacao>['meio']

export type ItemOrcamento = { id: string; descricao: string; quantidade: number; precoUnitario: number }

export type Orcamento = {
  id: string
  versao: number
  status: StatusOrcamento
  descontoValor: number | null
  descontoPercentual: number | null
  aprovadoPor: string | null
  aprovadoMeio: MeioAprovacao | null
  aprovadoEm: string | null
  recusadoEm: string | null
  itens: ItemOrcamento[]
}

export type PecaDoOrcamento = { descricao: string; quantidade: number; precoUnitario: number }

export type DadosOrcamento = {
  /** A versão mais nova (a que vale); `null` se a OS ainda não tem orçamento. */
  atual: Orcamento | null
  /** Versões anteriores, da mais nova para a mais velha. */
  anteriores: { versao: number; status: StatusOrcamento }[]
  /** Peças da OS: entram no total cobrado. O custo nunca vem aqui. */
  pecas: PecaDoOrcamento[]
}

export type DadosItem = z.input<typeof esquemaItemOrcamento>
export type DadosDesconto = z.input<typeof esquemaDesconto>
export type DadosAprovacao = z.input<typeof esquemaAprovacao>

const ACESSO_NEGADO = { ok: false, erro: 'Acesso negado' } as const
const OK = { ok: true } as const
export const ORCAMENTO_TRAVADO = 'Este orçamento já foi enviado. Para alterar, crie uma nova versão.'

type Linha = Record<string, unknown>
const numero = (v: unknown) => (v == null ? null : Number(v))

export async function carregarOrcamentoCom(supabase: SupabaseClient, osId: string): Promise<DadosOrcamento> {
  const [orcs, pecas] = await Promise.all([
    supabase
      .from('os_orcamentos')
      .select('id, versao, status, desconto_valor, desconto_percentual, aprovado_por, aprovado_meio, aprovado_em, recusado_em')
      .eq('os_id', osId)
      .order('versao', { ascending: false }),
    supabase.from('os_pecas').select('descricao, quantidade, preco_unitario').eq('os_id', osId).order('criado_em'),
  ])
  const linhas = (orcs.data ?? []) as Linha[]
  const listaPecas = ((pecas.data ?? []) as Linha[]).map((p) => ({
    descricao: p.descricao as string,
    quantidade: p.quantidade as number,
    precoUnitario: Number(p.preco_unitario),
  }))
  if (!linhas.length) return { atual: null, anteriores: [], pecas: listaPecas }

  const [a, ...resto] = linhas
  const { data: itens } = await supabase
    .from('os_orcamento_itens')
    .select('id, descricao, quantidade, preco_unitario')
    .eq('orcamento_id', a.id as string)
    .order('ordem')
    .order('criado_em')

  return {
    atual: {
      id: a.id as string,
      versao: a.versao as number,
      status: a.status as StatusOrcamento,
      descontoValor: numero(a.desconto_valor),
      descontoPercentual: numero(a.desconto_percentual),
      aprovadoPor: a.aprovado_por as string | null,
      aprovadoMeio: a.aprovado_meio as MeioAprovacao | null,
      aprovadoEm: a.aprovado_em as string | null,
      recusadoEm: a.recusado_em as string | null,
      itens: ((itens ?? []) as Linha[]).map((i) => ({
        id: i.id as string,
        descricao: i.descricao as string,
        quantidade: i.quantidade as number,
        precoUnitario: Number(i.preco_unitario),
      })),
    },
    anteriores: resto.map((o) => ({ versao: o.versao as number, status: o.status as StatusOrcamento })),
    pecas: listaPecas,
  }
}

/**
 * Lança um item. Se a OS ainda não tem orçamento, cria a versão 1 em rascunho antes. O item só entra
 * no rascunho: orçamento já enviado exige nova versão.
 */
export async function adicionarItemCom(deps: Dependencias, osId: string, dados: DadosItem): Promise<Resultado> {
  const lido = esquemaItemOrcamento.safeParse(dados)
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
  if (ehTerminal(os.status as StatusOS)) return { ok: false, erro: 'A OS já foi encerrada.' }

  const { data: atual, error: falhaAtual } = await supabase
    .from('os_orcamentos')
    .select('id, status')
    .eq('os_id', osId)
    .eq('loja_id', membro.lojaId)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (falhaAtual) return erroDoBanco(falhaAtual)

  let orcamentoId = atual?.id as string | undefined
  if (atual && atual.status !== 'rascunho') return { ok: false, erro: ORCAMENTO_TRAVADO }
  if (!orcamentoId) {
    const { data: novo, error } = await supabase
      .from('os_orcamentos')
      .insert({ loja_id: membro.lojaId, os_id: osId })
      .select('id')
      .single()
    if (error || !novo) return error ? erroDoBanco(error) : { ok: false, erro: FALHA_SALVAR }
    orcamentoId = novo.id as string
  }

  const v = lido.data
  const { error } = await supabase.from('os_orcamento_itens').insert({
    orcamento_id: orcamentoId,
    loja_id: membro.lojaId,
    descricao: v.descricao,
    quantidade: v.quantidade,
    preco_unitario: v.precoUnitario,
    servico_id: v.servicoId ?? null,
  })
  return error ? erroDoBanco(error) : OK
}

export async function removerItemCom(deps: Dependencias, itemId: string): Promise<Resultado> {
  if (!itemId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO
  const { data, error } = await deps.supabase
    .from('os_orcamento_itens')
    .delete()
    .eq('id', itemId)
    .eq('loja_id', membro.lojaId)
    .select('id')
  if (error) return erroDoBanco(error)
  return data?.length ? OK : { ok: false, erro: 'Item não encontrado' }
}

export async function salvarDescontoCom(deps: Dependencias, orcamentoId: string, dados: DadosDesconto): Promise<Resultado> {
  const lido = esquemaDesconto.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  if (!orcamentoId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO

  const d = lido.data
  const { data, error } = await deps.supabase
    .from('os_orcamentos')
    .update({
      desconto_valor: d.tipo === 'valor' ? d.valor : null,
      desconto_percentual: d.tipo === 'percentual' ? d.valor : null,
    })
    .eq('id', orcamentoId)
    .eq('loja_id', membro.lojaId)
    .select('id')
  if (error) return erroDoBanco(error)
  return data?.length ? OK : { ok: false, erro: 'Orçamento não encontrado' }
}

async function chamar(deps: Dependencias, funcao: string, args: Record<string, unknown>): Promise<Resultado> {
  if (!args.orc) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO
  const { error } = await deps.supabase.rpc(funcao, args)
  return error ? erroDoBanco(error) : OK
}

export function enviarOrcamentoCom(deps: Dependencias, orcamentoId: string) {
  return chamar(deps, 'enviar_orcamento_os', { orc: orcamentoId })
}

export async function aprovarOrcamentoCom(deps: Dependencias, orcamentoId: string, dados: DadosAprovacao): Promise<Resultado> {
  const lido = esquemaAprovacao.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  return chamar(deps, 'aprovar_orcamento_os', { orc: orcamentoId, por: lido.data.por, meio: lido.data.meio })
}

export function recusarOrcamentoCom(deps: Dependencias, orcamentoId: string) {
  return chamar(deps, 'recusar_orcamento_os', { orc: orcamentoId })
}

export function novaVersaoCom(deps: Dependencias, orcamentoId: string) {
  return chamar(deps, 'editar_orcamento_os', { orc: orcamentoId })
}
