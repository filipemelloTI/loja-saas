import 'server-only'
import { carregarOSCom, listarOSCom, type OSCompleta, type ResumoOS } from '@/lib/os'
import { carregarOrcamentoCom, type DadosOrcamento } from '@/lib/orcamento-acoes'
import { carregarPecasCom, type DadosPecas } from '@/lib/pecas-acoes'
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
