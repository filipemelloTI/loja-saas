import type { TomSelo } from '@/components/ui/Selo'
import type { Modulo, Perfil } from './tipos'

/** Módulos na ordem em que aparecem nas telas. */
export const MODULOS: Modulo[] = ['servico', 'estoque', 'vendas', 'fornecedores', 'financeiro']

export const ROTULO_MODULO: Record<Modulo, string> = {
  servico: 'Serviço',
  estoque: 'Estoque',
  vendas: 'Vendas',
  fornecedores: 'Fornecedores',
  financeiro: 'Financeiro',
}

export type Situacao = 'em_dia' | 'atrasado' | 'suspensa'

export const SITUACAO: Record<Situacao, { rotulo: string; tom: TomSelo }> = {
  em_dia: { rotulo: 'Em dia', tom: 'info' },
  atrasado: { rotulo: 'Atrasado', tom: 'aviso' },
  suspensa: { rotulo: 'Suspensa', tom: 'perigo' },
}

export function listarModulos(modulos: Modulo[]): string {
  const nomes = MODULOS.filter((m) => modulos.includes(m)).map((m) => ROTULO_MODULO[m])
  return nomes.length ? nomes.join(', ') : 'Nenhum'
}

export const ROTULO_PERFIL: Record<Perfil, string> = { dono: 'Dono', tecnico: 'Técnico', atendente: 'Atendente' }

/** Formas de pagamento que a loja pode aceitar (valores gravados em `config_loja.formas_pagamento`). */
export const FORMAS_PAGAMENTO = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
} as const

export type FormaPagamento = keyof typeof FORMAS_PAGAMENTO
