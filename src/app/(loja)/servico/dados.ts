import 'server-only'
import { carregarOSCom, listarOSCom, type OSCompleta, type ResumoOS } from '@/lib/os'
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
