'use server'

import { headers } from 'next/headers'
import { refresh } from 'next/cache'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import {
  atualizarLojaCom,
  criarLojaCom,
  novoLinkDonoCom,
  salvarPlanoCom,
  type DadosLoja,
  type DadosPlano,
  type Dependencias,
} from '@/lib/plataforma'

/**
 * Admin conferido no servidor pela sessão (nunca por flag vinda do cliente);
 * gravações com a service role, que passa mesmo com suporte aberto na loja.
 */
function dependencias(): Dependencias {
  return {
    souAdmin: async () => {
      const supabase = await criarClienteServidor()
      const { data, error } = await supabase.rpc('sou_admin_plataforma')
      return !error && data === true
    },
    admin: criarClienteAdmin(),
    origem: async () => {
      if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
      const h = await headers()
      const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
      const protocolo = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
      return `${protocolo}://${host}`
    },
  }
}

export async function criarLoja(form: FormData) {
  const r = await criarLojaCom(dependencias(), form)
  if (r.ok) refresh()
  return r
}

export async function atualizarLoja(id: string, dados: DadosLoja) {
  const r = await atualizarLojaCom(dependencias(), id, dados)
  if (r.ok) refresh()
  return r
}

export async function salvarPlano(dados: DadosPlano) {
  const r = await salvarPlanoCom(dependencias(), dados)
  if (r.ok) refresh()
  return r
}

export async function novoLinkDono(lojaId: string) {
  return novoLinkDonoCom(dependencias(), lojaId)
}
