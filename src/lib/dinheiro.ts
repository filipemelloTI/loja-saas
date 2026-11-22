export function formatarReais(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export function margem(preco: number, custo: number): { valor: number; percentual: number } {
  const valor = preco - custo
  const percentual = preco === 0 ? 0 : Math.round((valor / preco) * 1000) / 10
  return { valor, percentual }
}
