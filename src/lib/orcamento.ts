/**
 * Contas do orçamento, da comissão e do lucro da OS (spec 8.4 e 8.5).
 * Tudo em centavos inteiros por dentro, para 0,1 + 0,2 dar 0,30.
 * A função de entrega no banco (entregar_os) faz a mesma conta e é ela que
 * congela os números; esta serve para a tela mostrar antes de gravar.
 */

export type Linha = { quantidade: number; precoUnitario: number }
export type LinhaCusto = { quantidade: number; custoUnitario: number | null }

const centavos = (reais: number) => Math.round(reais * 100)
const reais = (c: number) => c / 100

function somar(linhas: Linha[]): number {
  return linhas.reduce((t, l) => t + l.quantidade * centavos(l.precoUnitario), 0)
}

export function calcularTotalOrcamento(entrada: {
  itens: Linha[]
  pecas: Linha[]
  descontoValor?: number | null
  descontoPercentual?: number | null
}): { subtotal: number; desconto: number; total: number } {
  const { descontoValor, descontoPercentual } = entrada
  if (descontoValor != null && descontoPercentual != null)
    throw new Error('Use desconto em valor ou em percentual, não os dois.')

  const subtotal = somar(entrada.itens) + somar(entrada.pecas)
  const pedido =
    descontoValor != null
      ? centavos(descontoValor)
      : descontoPercentual != null
        ? Math.round((subtotal * descontoPercentual) / 100)
        : 0
  const desconto = Math.min(Math.max(pedido, 0), subtotal)
  return { subtotal: reais(subtotal), desconto: reais(desconto), total: reais(subtotal - desconto) }
}

/** Custo total das peças; `null` se alguma ainda está sem custo (pendente para o Dono). */
export function somarCustoPecas(pecas: LinhaCusto[]): number | null {
  let total = 0
  for (const p of pecas) {
    if (p.custoUnitario == null) return null
    total += p.quantidade * centavos(p.custoUnitario)
  }
  return reais(total)
}

/** Comissão = % × (total cobrado − custo das peças), nunca negativa. */
export function calcularComissao(entrada: { total: number; custoPecas: number; percentual: number }): number {
  const base = centavos(entrada.total) - centavos(entrada.custoPecas)
  if (base <= 0) return 0
  return reais(Math.round((base * entrada.percentual) / 100))
}

/** Lucro = total cobrado − custo das peças − comissão. Pode ser negativo. */
export function calcularLucro(entrada: { total: number; custoPecas: number; comissao: number }): number {
  return reais(centavos(entrada.total) - centavos(entrada.custoPecas) - centavos(entrada.comissao))
}
