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
