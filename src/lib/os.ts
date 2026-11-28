import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import { erroDoBanco, FALHA_SALVAR, primeiroErro, type Resultado } from '@/lib/resultado'
import { ehTerminal, podeMudar, ROTULO_STATUS, type StatusOS } from '@/lib/os-status'
import type { Perfil } from '@/lib/tipos'
import { esquemaLaudo, esquemaNovaOS } from '@/lib/validacoes'

/**
 * Regras das ações de OS, com as dependências injetadas para teste.
 * As Server Actions (`src/app/(loja)/servico/acoes.ts`) só montam as dependências.
 * Ordem sempre: validar (sem rede) → conferir membro, perfil e transição → gravar com o cliente
 * da sessão (a RLS confere de novo). A loja vem sempre da sessão, nunca do que a tela mandou.
 *
 * A senha do aparelho só trafega como PARÂMETRO do rpc, nunca concatenada em texto SQL (senão o
 * texto puro iria parar em log_statement e pg_stat_statements). Nunca é logada nem devolvida.
 */
export type Dependencias = {
  /** Loja e perfil de quem chamou, se for membro ativo; `null` para qualquer outro (inclusive admin em suporte). */
  membroDaSessao: () => Promise<{ lojaId: string; perfil: Perfil } | null>
  /** Cliente da sessão (respeita RLS). */
  supabase: SupabaseClient
}

export type DadosNovaOS = z.input<typeof esquemaNovaOS>

export type ResultadoAbrirOS = { ok: true; id: string; numero: number } | { ok: false; erro: string }

const ACESSO_NEGADO = { ok: false, erro: 'Acesso negado' } as const
const NAO_ENCONTRADA = { ok: false, erro: 'OS não encontrada' } as const
const OK = { ok: true } as const
const OS_INCOMPLETA = 'A OS pode ter sido criada sem o checklist ou a senha. Confira a lista de OS antes de abrir outra.'
export const MEMBRO_NAO_IDENTIFICADO = 'Não identificado'

const vazioViraNulo = (v?: string) => (v ? v : null)

/**
 * Abre a OS, copia o checklist (só os nomes, nunca ids da lista da loja) e guarda a senha, se veio.
 * Sem transação no supabase-js: se uma etapa depois da OS falhar, a OS recém-criada é apagada (o
 * checklist cai junto, em cascata), para a tentativa seguinte não deixar OS duplicada.
 */
export async function abrirOSCom(deps: Dependencias, dados: DadosNovaOS): Promise<ResultadoAbrirOS> {
  const lido = esquemaNovaOS.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO

  const v = lido.data
  const { data, error } = await deps.supabase
    .from('ordens_servico')
    .insert({
      loja_id: membro.lojaId,
      cliente_id: v.interna ? null : vazioViraNulo(v.clienteId),
      interna: v.interna,
      aparelho_tipo: v.aparelhoTipo,
      marca: vazioViraNulo(v.marca),
      modelo: vazioViraNulo(v.modelo),
      cor: vazioViraNulo(v.cor),
      imei: vazioViraNulo(v.imei),
      defeito_relatado: v.defeitoRelatado,
      acessorios: v.acessorios ?? [],
      observacao: vazioViraNulo(v.observacao),
      tecnico_id: vazioViraNulo(v.tecnicoId),
      previsao_entrega: vazioViraNulo(v.previsaoEntrega),
    })
    .select('id, numero')
    .single()
  if (error || !data) return error ? erroDoBanco(error) : { ok: false, erro: FALHA_SALVAR }
  const id = data.id as string

  const desfazer = async (erro: string): Promise<ResultadoAbrirOS> => {
    // Só vale como desfeito se o banco confirma a linha apagada; zero linhas é tão ruim quanto erro.
    const { data: apagadas, error: naoApagou } = await deps.supabase
      .from('ordens_servico')
      .delete()
      .eq('id', id)
      .eq('loja_id', membro.lojaId)
      .select('id')
    return { ok: false, erro: naoApagou || !apagadas?.length ? OS_INCOMPLETA : erro }
  }

  if (v.checklist?.length) {
    const linhas = v.checklist.map((i) => ({
      os_id: id,
      loja_id: membro.lojaId,
      nome: i.nome,
      marcado: i.marcado,
      observacao: vazioViraNulo(i.observacao),
    }))
    const { error: falha } = await deps.supabase.from('os_checklist').insert(linhas)
    if (falha) return desfazer(erroDoBanco(falha).erro)
  }

  if (v.senhaAparelho) {
    const { error: falha } = await deps.supabase.rpc('guardar_senha_aparelho', { os: id, senha: v.senhaAparelho })
    if (falha) return desfazer(FALHA_SALVAR)
  }

  return { ok: true, id, numero: data.numero as number }
}

/**
 * Muda a etapa da OS. A transição é conferida aqui (`podeMudar`) antes de qualquer escrita; a
 * gravação do status e da linha de histórico é uma função só no banco (`mudar_status_os`), na mesma
 * transação, para a tela nunca dizer que mudou sem registro, nem o histórico afirmar o que não houve.
 */
export async function mudarStatusCom(
  deps: Dependencias,
  osId: string,
  para: StatusOS,
  observacao?: string,
): Promise<Resultado> {
  if (!osId || !Object.hasOwn(ROTULO_STATUS, para)) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO

  const { data, error } = await deps.supabase
    .from('ordens_servico')
    .select('status')
    .eq('id', osId)
    .eq('loja_id', membro.lojaId)
    .maybeSingle()
  if (error) return erroDoBanco(error)
  if (!data) return NAO_ENCONTRADA

  const de = data.status as StatusOS
  const pode = podeMudar(de, para, membro.perfil)
  if (!pode.ok) return pode

  const { error: falha } = await deps.supabase.rpc('mudar_status_os', {
    os: osId,
    de, // o status contra o qual podeMudar validou: se mudou nesse meio tempo, o banco recusa
    para,
    observacao: vazioViraNulo(observacao?.trim()),
  })
  return falha ? erroDoBanco(falha) : OK
}

export async function salvarLaudoCom(deps: Dependencias, osId: string, laudo: string): Promise<Resultado> {
  const lido = esquemaLaudo.safeParse({ laudo })
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  if (!osId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO

  // OS encerrada é registro fechado: o laudo não muda mais, e a conferência é daqui, não só da tela.
  const { data: atual, error: falhaLeitura } = await deps.supabase
    .from('ordens_servico')
    .select('status')
    .eq('id', osId)
    .eq('loja_id', membro.lojaId)
    .maybeSingle()
  if (falhaLeitura) return erroDoBanco(falhaLeitura)
  if (!atual) return NAO_ENCONTRADA
  if (ehTerminal(atual.status as StatusOS)) return { ok: false, erro: 'A OS já foi encerrada.' }

  const { data, error } = await deps.supabase
    .from('ordens_servico')
    .update({ laudo: lido.data.laudo })
    .eq('id', osId)
    .eq('loja_id', membro.lojaId)
    .select('id')
    .maybeSingle()
  if (error) return erroDoBanco(error)
  return data ? OK : NAO_ENCONTRADA
}

// Leitura ------------------------------------------------------------------

export type ResumoOS = {
  id: string
  numero: number
  aparelhoTipo: string
  marca: string | null
  modelo: string | null
  status: StatusOS
  interna: boolean
  clienteNome: string | null
  previsaoEntrega: string | null
  criadoEm: string
}

export type OSCompleta = {
  id: string
  numero: number
  interna: boolean
  clienteId: string | null
  clienteNome: string | null
  aparelhoTipo: string
  marca: string | null
  modelo: string | null
  cor: string | null
  imei: string | null
  defeitoRelatado: string
  acessorios: string[]
  observacao: string | null
  tecnicoId: string | null
  laudo: string | null
  previsaoEntrega: string | null
  status: StatusOS
  encerradaEm: string | null
  criadoEm: string
  /** Token do link público de acompanhamento (vai na mensagem ao cliente). */
  tokenPublico: string
  checklist: { nome: string; marcado: boolean; observacao: string | null }[]
  historico: {
    deStatus: StatusOS | null
    paraStatus: StatusOS
    membroId: string | null
    /** Nome de quem mudou; rótulo neutro quando a linha não tem membro. */
    membroNome: string
    observacao: string | null
    criadoEm: string
  }[]
  /** Só vem preenchida quando a tela vai mostrá-la; a função do banco decide por perfil. */
  senhaAparelho: string | null
}

type Linha = Record<string, unknown>

const COLUNAS_OS =
  'id, numero, interna, cliente_id, aparelho_tipo, marca, modelo, cor, imei, defeito_relatado, acessorios, observacao, tecnico_id, laudo, previsao_entrega, status, encerrada_em, criado_em, token_publico'

/** Quem pode ver a senha do aparelho (a função do banco confere de novo; aqui só se poupa a ida à rede). */
const PERFIS_COM_SENHA: Perfil[] = ['dono', 'tecnico']

async function nomesDosClientes(supabase: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const { data } = await supabase.from('clientes').select('id, nome').in('id', ids)
  return new Map(((data ?? []) as { id: string; nome: string }[]).map((c) => [c.id, c.nome]))
}

/** Lista as OS, das mais recentes para as mais antigas, com filtro opcional por status. Nunca toca a senha. */
export async function listarOSCom(deps: Pick<Dependencias, 'supabase'>, status?: StatusOS): Promise<ResumoOS[]> {
  let consulta = deps.supabase
    .from('ordens_servico')
    .select('id, numero, aparelho_tipo, marca, modelo, status, interna, cliente_id, previsao_entrega, criado_em')
  if (status) consulta = consulta.eq('status', status)
  const { data, error } = await consulta.order('criado_em', { ascending: false }).limit(200)
  if (error) {
    console.error('listarOS: falhou', { code: error.code })
    return []
  }
  const linhas = (data ?? []) as Linha[]
  const nomes = await nomesDosClientes(
    deps.supabase,
    [...new Set(linhas.map((o) => o.cliente_id as string | null).filter((c): c is string => !!c))],
  )
  return linhas.map((o) => ({
    id: o.id as string,
    numero: o.numero as number,
    aparelhoTipo: o.aparelho_tipo as string,
    marca: o.marca as string | null,
    modelo: o.modelo as string | null,
    status: o.status as StatusOS,
    interna: o.interna as boolean,
    clienteNome: nomes.get(o.cliente_id as string) ?? null,
    previsaoEntrega: o.previsao_entrega as string | null,
    criadoEm: o.criado_em as string,
  }))
}

/**
 * A OS completa para a tela de detalhe. A senha só é buscada aqui (nunca na lista) e só se a OS
 * ainda está aberta e o perfil é dono ou técnico; a função `senha_aparelho` confere o perfil de novo.
 */
export async function carregarOSCom(deps: { supabase: SupabaseClient; perfil: Perfil }, id: string): Promise<OSCompleta | null> {
  const { supabase } = deps
  const { data: os, error } = await supabase.from('ordens_servico').select(COLUNAS_OS).eq('id', id).maybeSingle()
  if (error || !os) return null
  const o = os as Linha
  const status = o.status as StatusOS

  const [checklist, historico, nomes, senha] = await Promise.all([
    supabase.from('os_checklist').select('nome, marcado, observacao').eq('os_id', id).order('nome'),
    supabase
      .from('os_historico')
      .select('de_status, para_status, membro_id, observacao, criado_em')
      .eq('os_id', id)
      .order('criado_em', { ascending: true }),
    nomesDosClientes(supabase, o.cliente_id ? [o.cliente_id as string] : []),
    ehTerminal(status) || !PERFIS_COM_SENHA.includes(deps.perfil)
      ? Promise.resolve({ data: null })
      : supabase.rpc('senha_aparelho', { os: id }),
  ])

  const linhasHistorico = (historico.data ?? []) as Linha[]
  const idsMembros = [...new Set(linhasHistorico.map((h) => h.membro_id as string | null).filter((m): m is string => !!m))]
  const membros = new Map<string, string>()
  if (idsMembros.length) {
    const { data: ms } = await supabase.from('membros').select('id, nome').in('id', idsMembros)
    for (const m of (ms ?? []) as { id: string; nome: string }[]) membros.set(m.id, m.nome)
  }

  return {
    id: o.id as string,
    numero: o.numero as number,
    interna: o.interna as boolean,
    clienteId: o.cliente_id as string | null,
    clienteNome: nomes.get(o.cliente_id as string) ?? null,
    aparelhoTipo: o.aparelho_tipo as string,
    marca: o.marca as string | null,
    modelo: o.modelo as string | null,
    cor: o.cor as string | null,
    imei: o.imei as string | null,
    defeitoRelatado: o.defeito_relatado as string,
    acessorios: (o.acessorios as string[] | null) ?? [],
    observacao: o.observacao as string | null,
    tecnicoId: o.tecnico_id as string | null,
    laudo: o.laudo as string | null,
    previsaoEntrega: o.previsao_entrega as string | null,
    status,
    encerradaEm: o.encerrada_em as string | null,
    criadoEm: o.criado_em as string,
    tokenPublico: o.token_publico as string,
    checklist: ((checklist.data ?? []) as Linha[]).map((c) => ({
      nome: c.nome as string,
      marcado: c.marcado as boolean,
      observacao: c.observacao as string | null,
    })),
    historico: linhasHistorico.map((h) => ({
      deStatus: h.de_status as StatusOS | null,
      paraStatus: h.para_status as StatusOS,
      membroId: h.membro_id as string | null,
      membroNome: membros.get(h.membro_id as string) ?? MEMBRO_NAO_IDENTIFICADO,
      observacao: h.observacao as string | null,
      criadoEm: h.criado_em as string,
    })),
    senhaAparelho: (senha.data as string | null) ?? null,
  }
}
