import { formatarReais, margem } from '@/lib/dinheiro'

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
})
