import type { SupabaseClient } from '@supabase/supabase-js'
import { situacaoGarantia, type Situacao } from '@/lib/garantia'
import { ROTULO_APARELHO } from '@/lib/rotulos'

/**
 * Consulta de garantias (spec 8.7): OS entregues ainda em garantia, as que vencem antes primeiro.
 * A busca por nome, telefone ou IMEI filtra na tela, para o termo nunca ir para a URL.
 */

export type ItemGarantia = {
  id: string
  numero: number
  cliente: string | null
  telefone: string | null
  aparelho: string
  imei: string | null
  venceEm: string
  diasRestantes: number
  situacao: Situacao
}

type Linha = Record<string, unknown>

export async function listarGarantiasCom(supabase: SupabaseClient, hoje: Date = new Date()): Promise<ItemGarantia[]> {
  const { data, error } = await supabase
    .from('ordens_servico')
    .select('id, numero, cliente_id, aparelho_tipo, marca, modelo, imei, encerrada_em, garantia_dias')
    .eq('status', 'entregue')
    .not('garantia_dias', 'is', null)
    .order('encerrada_em', { ascending: false })
    .limit(1000)
  if (error) {
    console.error('listarGarantias: falhou', { code: error.code })
    return []
  }
  const linhas = (data ?? []) as Linha[]
  const ids = [...new Set(linhas.map((l) => l.cliente_id as string | null).filter((c): c is string => !!c))]
  const clientes = new Map<string, { nome: string; telefone: string | null }>()
  if (ids.length) {
    const { data: cs } = await supabase.from('clientes').select('id, nome, telefone').in('id', ids)
    for (const c of (cs ?? []) as Linha[]) clientes.set(c.id as string, { nome: c.nome as string, telefone: c.telefone as string | null })
  }

  return linhas
    .map((l) => {
      const s = situacaoGarantia(l.encerrada_em as string, l.garantia_dias as number, hoje)
      const cliente = clientes.get(l.cliente_id as string)
      return {
        id: l.id as string,
        numero: l.numero as number,
        cliente: cliente?.nome ?? null,
        telefone: cliente?.telefone ?? null,
        aparelho: [ROTULO_APARELHO[l.aparelho_tipo as string] ?? 'Aparelho', l.marca, l.modelo].filter(Boolean).join(' · '),
        imei: (l.imei as string | null) ?? null,
        ...s,
      }
    })
    .filter((g) => g.situacao !== 'vencida')
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Nome (sem acento, sem caixa), ou só os dígitos contra telefone e IMEI. */
export function filtrarGarantias(itens: ItemGarantia[], termo: string, soVencendo = false): ItemGarantia[] {
  const texto = semAcento(termo.trim())
  const digitos = termo.replace(/\D/g, '')
  return itens.filter((g) => {
    if (soVencendo && g.situacao !== 'vencendo') return false
    if (!texto) return true
    if (g.cliente && semAcento(g.cliente).includes(texto)) return true
    if (digitos.length >= 3) {
      if (g.telefone?.replace(/\D/g, '').includes(digitos)) return true
      if (g.imei?.replace(/\D/g, '').includes(digitos)) return true
    }
    return String(g.numero) === termo.trim()
  })
}
