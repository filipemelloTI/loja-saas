import { calcularTotalOrcamento } from '@/lib/orcamento'
import type { StatusOS } from '@/lib/os-status'

/**
 * Dados do link público de acompanhamento, como a função `acompanhamento_os` do banco os devolve,
 * já convertidos e com as contas feitas. Nada aqui é sigiloso: o banco só manda o que o cliente pode ver.
 */

export type StatusOrcamentoPublico = 'enviado' | 'aprovado' | 'recusado'
type Linha = { descricao: string; quantidade: number; precoUnitario: number }

export type Acompanhamento = {
  loja: { nome: string; telefone: string | null; endereco: string | null; logoPath: string | null }
  cliente: string | null
  os: {
    numero: number
    aparelho: string
    status: StatusOS
    criadoEm: string
    encerradaEm: string | null
    previsaoEntrega: string | null
  }
  historico: { status: StatusOS; em: string }[]
  orcamento: {
    id: string
    versao: number
    status: StatusOrcamentoPublico
    aprovadoEm: string | null
    recusadoEm: string | null
    itens: Linha[]
    descontoValor: number | null
    descontoPercentual: number | null
  } | null
  pecas: Linha[]
  conta: { subtotal: number; desconto: number; total: number; pago: number; falta: number }
  garantia: { dias: number; venceEm: string; condicoes: string[] } | null
}

const APARELHO: Record<string, string> = {
  celular: 'Celular',
  tablet: 'Tablet',
  relogio: 'Relógio',
  notebook: 'Notebook',
  outro: 'Aparelho',
}

export function tokenValido(token: string): boolean {
  return /^[0-9a-f]{48}$/.test(token)
}

type Bruto = Record<string, unknown>
const num = (v: unknown) => (v == null ? null : Number(v))
const linhas = (v: unknown): Linha[] =>
  ((v as Bruto[] | null) ?? []).map((l) => ({
    descricao: l.descricao as string,
    quantidade: Number(l.quantidade),
    precoUnitario: Number(l.preco_unitario),
  }))

/** Converte o JSON do banco. `null` entra como `null` (link inexistente ou loja suspensa). */
export function lerAcompanhamento(bruto: unknown): Acompanhamento | null {
  if (!bruto || typeof bruto !== 'object') return null
  const b = bruto as Bruto
  const loja = b.loja as Bruto
  const os = b.os as Bruto
  const o = b.orcamento as Bruto | null
  const g = b.garantia as Bruto | null

  const orcamento = o
    ? {
        id: o.id as string,
        versao: Number(o.versao),
        status: o.status as StatusOrcamentoPublico,
        aprovadoEm: (o.aprovado_em as string | null) ?? null,
        recusadoEm: (o.recusado_em as string | null) ?? null,
        itens: linhas(o.itens),
        descontoValor: num(o.desconto_valor),
        descontoPercentual: num(o.desconto_percentual),
      }
    : null
  const pecas = linhas(b.pecas)
  const pago = Number(b.pago ?? 0)
  const { subtotal, desconto, total } =
    orcamento && orcamento.status !== 'recusado'
      ? calcularTotalOrcamento({
          itens: orcamento.itens,
          pecas,
          descontoValor: orcamento.descontoValor,
          descontoPercentual: orcamento.descontoPercentual,
        })
      : { subtotal: 0, desconto: 0, total: 0 }

  return {
    loja: {
      nome: loja.nome as string,
      telefone: (loja.telefone as string | null) ?? null,
      endereco: (loja.endereco as string | null) ?? null,
      logoPath: (loja.logo_path as string | null) ?? null,
    },
    cliente: (b.cliente as string | null) || null,
    os: {
      numero: Number(os.numero),
      aparelho: [APARELHO[os.aparelho_tipo as string] ?? 'Aparelho', os.marca, os.modelo].filter(Boolean).join(' · '),
      status: os.status as StatusOS,
      criadoEm: os.criado_em as string,
      encerradaEm: (os.encerrada_em as string | null) ?? null,
      previsaoEntrega: (os.previsao_entrega as string | null) ?? null,
    },
    historico: ((b.historico as Bruto[] | null) ?? []).map((h) => ({
      status: h.para_status as StatusOS,
      em: h.criado_em as string,
    })),
    orcamento,
    pecas,
    conta: { subtotal, desconto, total, pago, falta: Math.max(Math.round((total - pago) * 100), 0) / 100 },
    garantia: g
      ? { dias: Number(g.dias), venceEm: g.vence_em as string, condicoes: (g.condicoes as string[] | null) ?? [] }
      : null,
  }
}
