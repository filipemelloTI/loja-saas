export function formatarReais(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export function margem(preco: number, custo: number): { valor: number; percentual: number } {
  const valor = preco - custo
  const percentual = preco === 0 ? 0 : Math.round((valor / preco) * 1000) / 10
  return { valor, percentual }
}

/** Margem para exibir: "R$ 270,00 · 41,5%". */
export function formatarMargem(preco: number, custo: number): string {
  const m = margem(preco, custo)
  const pct = m.percentual.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${formatarReais(m.valor)} · ${pct}%`
}

/**
 * Valor digitado em reais ("1.234,56", "650", "R$ 380,5") para número; `NaN` se não der.
 * Com vírgula, o ponto é separador de milhar; sem vírgula, o ponto é decimal.
 */
export function lerReais(texto: string): number {
  const limpo = texto.replace(/R\$|\s/g, '')
  if (!/^\d[\d.,]*$/.test(limpo)) return NaN
  return Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo)
}
