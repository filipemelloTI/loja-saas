import { formatarMargem, formatarReais, lerReais, margem } from '@/lib/dinheiro'

describe('dinheiro', () => {
  it('formata em reais', () => {
    expect(formatarReais(1234.5).replace(/\u00a0/g, ' ')).toBe('R$ 1.234,50')
  })
  it('calcula margem com 1 casa sobre o preço', () => {
    expect(margem(650, 380)).toEqual({ valor: 270, percentual: 41.5 })
  })
  it('preço zero dá percentual 0', () => {
    expect(margem(0, 10).percentual).toBe(0)
  })
  it('mostra a margem como "R$ 270,00 · 41,5%"', () => {
    expect(formatarMargem(650, 380).replace(/ /g, ' ')).toBe('R$ 270,00 · 41,5%')
  })
  it('lê valores digitados em reais', () => {
    expect(lerReais('650')).toBe(650)
    expect(lerReais('1.234,56')).toBe(1234.56)
    expect(lerReais('R$ 380,5')).toBe(380.5)
    expect(lerReais('12.5')).toBe(12.5)
    expect(lerReais('')).toBeNaN()
    expect(lerReais('abc')).toBeNaN()
  })
})
