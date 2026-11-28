import 'server-only'
import { carregarOSCom, listarOSCom, type OSCompleta, type ResumoOS } from '@/lib/os'
import { carregarOrcamentoCom, type DadosOrcamento } from '@/lib/orcamento-acoes'
import { carregarPecasCom, type DadosPecas } from '@/lib/pecas-acoes'
import { carregarPagamentosCom, totalDaOSCom, type Pagamento } from '@/lib/pagamento-acoes'
import { carregarFechamentoCom, type Fechamento } from '@/lib/fechamento'
import { eventoValido, type Evento } from '@/lib/mensagens'
import { origemDoSite } from '@/lib/origem'
import type { StatusOS } from '@/lib/os-status'
import { perfilEfetivo } from '@/lib/guarda'
import { exigirArea } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'

/** Leituras das telas de Serviço: confere a área e lê pelo cliente da sessão (a RLS isola a loja). */
async function base() {
  const ctx = await exigirArea('servico')
  return { supabase: await criarClienteServidor(), somenteLeitura: ctx.emSuporte, perfil: perfilEfetivo(ctx) ?? 'atendente' }
}

/** Lista de OS, com filtro opcional por status. Nunca carrega a senha do aparelho. */
export async function listarOS(status?: StatusOS): Promise<{ ordens: ResumoOS[]; somenteLeitura: boolean }> {
  const { supabase, somenteLeitura } = await base()
  return { ordens: await listarOSCom({ supabase }, status), somenteLeitura }
}

/** OS completa; a senha vem junto só nesta leitura de detalhe, e a função do banco decide quem a vê. */
export async function carregarOS(id: string): Promise<{ os: OSCompleta | null; somenteLeitura: boolean }> {
  const { supabase, somenteLeitura, perfil } = await base()
  return { os: await carregarOSCom({ supabase, perfil }, id), somenteLeitura }
}

/** Orçamento da OS (versão atual, anteriores) e as peças que entram no total. Nunca traz custo. */
export async function carregarOrcamento(osId: string): Promise<DadosOrcamento> {
  const { supabase } = await base()
  return carregarOrcamentoCom(supabase, osId)
}

/** Peças da OS; o custo só vem para o Dono, os outros recebem só quantas estão sem custo. */
export async function carregarPecas(osId: string): Promise<DadosPecas & { podeVerCusto: boolean }> {
  const { supabase, perfil, somenteLeitura } = await base()
  const podeVerCusto = perfil === 'dono' && !somenteLeitura
  return { ...(await carregarPecasCom(supabase, osId, podeVerCusto ? 'dono' : 'atendente')), podeVerCusto }
}

export type DadosPagamentoOS = {
  pagamentos: Pagamento[]
  /** Total cobrado hoje (orçamento atual + peças − desconto). */
  total: number
  /** Formas que a loja aceita, na ordem das Configurações. */
  formas: string[]
  podeRemover: boolean
}

/** Pagamentos da OS, o total a cobrar e as formas aceitas pela loja. */
export async function carregarPagamento(osId: string): Promise<DadosPagamentoOS> {
  const { supabase, perfil, somenteLeitura } = await base()
  const [pagamentos, total, config] = await Promise.all([
    carregarPagamentosCom(supabase, osId),
    totalDaOSCom(supabase, osId),
    supabase.from('config_loja').select('formas_pagamento').maybeSingle(),
  ])
  return {
    pagamentos,
    total,
    formas: (config.data?.formas_pagamento as string[] | undefined) ?? [],
    podeRemover: perfil === 'dono' && !somenteLeitura,
  }
}

/** Custo, comissão e lucro congelados na entrega. Só o Dono recebe; os outros, `null`. */
export async function carregarFechamento(osId: string): Promise<Fechamento | null> {
  const { supabase, perfil, somenteLeitura } = await base()
  if (perfil !== 'dono' || somenteLeitura) return null
  return carregarFechamentoCom(supabase, osId)
}

export type DadosAviso = {
  telefone: string | null
  mensagens: Partial<Record<Evento, string>>
  /** Endereço completo do link público desta OS; `null` se o endereço do site não está configurado. */
  linkAcompanhamento: string | null
}

/** O que o cartão "Avisar cliente" precisa: telefone do cliente, mensagens da loja e o link público. */
export async function carregarAviso(clienteId: string | null, tokenPublico: string): Promise<DadosAviso> {
  const { supabase } = await base()
  const [cliente, mensagens, origem] = await Promise.all([
    clienteId
      ? supabase.from('clientes').select('telefone').eq('id', clienteId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('mensagens_padrao').select('evento, texto'),
    // Sem o endereço do site configurado, o cartão segue sem o link (a página da OS não pode cair).
    origemDoSite().catch((e: unknown) => {
      console.error('carregarAviso: endereço do site indisponível', e instanceof Error ? e.message : e)
      return null
    }),
  ])
  return {
    telefone: (cliente.data?.telefone as string | undefined) ?? null,
    mensagens: Object.fromEntries(
      ((mensagens.data ?? []) as { evento: string; texto: string }[])
        .filter((m) => eventoValido(m.evento))
        .map((m) => [m.evento, m.texto]),
    ),
    linkAcompanhamento: origem ? `${origem}/acompanhar/${tokenPublico}` : null,
  }
}

export type DadosGarantia = {
  /** Prazo que a OS terá ao ser entregue (ajuste do Dono, catálogo ou padrão da loja). */
  prevista: number | null
  /** Número da OS original, quando esta é de garantia. */
  numeroOriginal: number | null
}

export async function carregarGarantia(osId: string, garantiaDe: string | null): Promise<DadosGarantia> {
  const { supabase } = await base()
  const [prevista, original] = await Promise.all([
    supabase.rpc('garantia_prevista_os', { os: osId }),
    garantiaDe
      ? supabase.from('ordens_servico').select('numero').eq('id', garantiaDe).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    prevista: (prevista.data as number | null) ?? null,
    numeroOriginal: (original.data?.numero as number | undefined) ?? null,
  }
}

export type DadosTermo = {
  loja: { cnpj: string | null; endereco: string | null; telefone: string | null; textoTermos: string | null }
  cliente: { nome: string; telefone: string | null } | null
  condicoes: string[]
}

/** O que o termo de garantia imprime além da OS: dados da loja, do cliente e as condições. */
export async function carregarTermo(clienteId: string | null): Promise<DadosTermo> {
  const { supabase } = await base()
  const [config, condicoes, cliente] = await Promise.all([
    supabase.from('config_loja').select('cnpj, endereco, telefone, texto_termos').maybeSingle(),
    supabase.from('condicoes_garantia').select('texto').order('ordem'),
    clienteId
      ? supabase.from('clientes').select('nome, telefone').eq('id', clienteId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const c = config.data as Record<string, string | null> | null
  return {
    loja: {
      cnpj: c?.cnpj ?? null,
      endereco: c?.endereco ?? null,
      telefone: c?.telefone ?? null,
      textoTermos: c?.texto_termos ?? null,
    },
    cliente: cliente.data ? { nome: cliente.data.nome as string, telefone: (cliente.data.telefone as string | null) ?? null } : null,
    condicoes: ((condicoes.data ?? []) as { texto: string }[]).map((x) => x.texto),
  }
}

export type ServicoCatalogo = { id: string; nome: string; preco: number }

/** Serviços ativos do catálogo da loja, para preencher o item do orçamento. O custo fica de fora. */
export async function listarServicosDaLoja(): Promise<ServicoCatalogo[]> {
  const { supabase } = await base()
  const { data } = await supabase.from('servicos').select('id, nome, preco').eq('ativo', true).order('nome')
  return ((data ?? []) as { id: string; nome: string; preco: unknown }[]).map((s) => ({
    id: s.id,
    nome: s.nome,
    preco: Number(s.preco),
  }))
}

export type ItemChecklist = { id: string; nome: string }
export type Tecnico = { id: string; nome: string }

/** Itens de checklist que a loja deixou ativos, na ordem que ela escolheu. A OS copia só os nomes. */
export async function listarChecklistDaLoja(): Promise<ItemChecklist[]> {
  const { supabase } = await base()
  const { data } = await supabase.from('checklist_itens').select('id, nome').eq('ativo', true).order('ordem')
  return ((data ?? []) as ItemChecklist[]).map(({ id, nome }) => ({ id, nome }))
}

/** Quem pode ficar com o conserto: membros ativos que são técnico ou Dono. */
export async function listarTecnicos(): Promise<Tecnico[]> {
  const { supabase } = await base()
  const { data } = await supabase
    .from('membros')
    .select('id, nome')
    .eq('ativo', true)
    .in('perfil', ['tecnico', 'dono'])
    .order('nome')
  return ((data ?? []) as Tecnico[]).map(({ id, nome }) => ({ id, nome }))
}

/**
 * Nome de quem está na OS como técnico, mesmo que hoje esteja inativo ou tenha mudado de perfil: a OS é
 * registro histórico. `null` quando a OS não tem técnico; "Técnico (inativo)" quando não dá mais para ler o nome.
 */
export async function nomeDoTecnicoDaOS(tecnicoId: string | null): Promise<string | null> {
  if (!tecnicoId) return null
  const { supabase } = await base()
  const { data } = await supabase.from('membros').select('nome').eq('id', tecnicoId).maybeSingle()
  return (data?.nome as string | undefined) || 'Técnico (inativo)'
}
