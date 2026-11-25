import 'server-only'
import { buscarClientesCom, COLUNAS_CLIENTE, type Cliente } from '@/lib/clientes'
import { exigirArea } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'

/** Leituras das telas de Clientes: confere a área e lê pelo cliente da sessão (a RLS isola a loja). */
async function base() {
  const ctx = await exigirArea('clientes')
  return { supabase: await criarClienteServidor(), somenteLeitura: ctx.emSuporte }
}

export async function listarClientes(termo: string) {
  const { supabase, somenteLeitura } = await base()
  return { clientes: await buscarClientesCom({ supabase }, termo), somenteLeitura }
}

export async function carregarCliente(id: string): Promise<Cliente | null> {
  const { supabase } = await base()
  const { data } = await supabase.from('clientes').select(COLUNAS_CLIENTE).eq('id', id).maybeSingle()
  return (data as Cliente | null) ?? null
}

export type OSDoCliente = {
  id: string
  numero: number
  aparelhoTipo: string
  marca: string | null
  modelo: string | null
  imei: string | null
  status: string
  criadoEm: string
}

/** OS do cliente, das mais recentes para as mais antigas. */
export async function carregarHistoricoDoCliente(id: string): Promise<OSDoCliente[]> {
  const { supabase } = await base()
  const { data } = await supabase
    .from('ordens_servico')
    .select('id, numero, aparelho_tipo, marca, modelo, imei, status, criado_em')
    .eq('cliente_id', id)
    .order('criado_em', { ascending: false })
  return (data ?? []).map((o) => ({
    id: o.id as string,
    numero: o.numero as number,
    aparelhoTipo: o.aparelho_tipo as string,
    marca: o.marca as string | null,
    modelo: o.modelo as string | null,
    imei: o.imei as string | null,
    status: o.status as string,
    criadoEm: o.criado_em as string,
  }))
}
