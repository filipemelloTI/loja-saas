import { describe, expect, test } from 'vitest'
import {
  calcularComissao,
  calcularLucro,
  calcularTotalOrcamento,
  somarCustoPecas,
} from '@/lib/orcamento'

describe('total do orçamento', () => {
  test('soma serviços e peças pelo preço cobrado', () => {
    expect(
      calcularTotalOrcamento({
        itens: [{ quantidade: 1, precoUnitario: 300 }],
        pecas: [{ quantidade: 1, precoUnitario: 350 }],
      }),
    ).toEqual({ subtotal: 650, desconto: 0, total: 650 })
  })

  test('multiplica pela quantidade', () => {
    expect(
      calcularTotalOrcamento({
        itens: [{ quantidade: 2, precoUnitario: 40 }],
        pecas: [{ quantidade: 3, precoUnitario: 10.1 }],
      }).total,
    ).toBe(110.3)
  })

  test('desconto em valor', () => {
    expect(
      calcularTotalOrcamento({
        itens: [{ quantidade: 1, precoUnitario: 650 }],
        pecas: [],
        descontoValor: 50,
      }),
    ).toEqual({ subtotal: 650, desconto: 50, total: 600 })
  })

  test('desconto em percentual, arredondado ao centavo', () => {
    expect(
      calcularTotalOrcamento({
        itens: [{ quantidade: 1, precoUnitario: 99.99 }],
        pecas: [],
        descontoPercentual: 10,
      }),
    ).toEqual({ subtotal: 99.99, desconto: 10, total: 89.99 })
  })

  test('desconto maior que o subtotal zera o total, sem ficar negativo', () => {
    expect(
      calcularTotalOrcamento({
        itens: [{ quantidade: 1, precoUnitario: 30 }],
        pecas: [],
        descontoValor: 50,
      }),
    ).toEqual({ subtotal: 30, desconto: 30, total: 0 })
  })

  test('não aceita os dois tipos de desconto juntos', () => {
    expect(() =>
      calcularTotalOrcamento({
        itens: [{ quantidade: 1, precoUnitario: 100 }],
        pecas: [],
        descontoValor: 10,
        descontoPercentual: 10,
      }),
    ).toThrow('Use desconto em valor ou em percentual, não os dois.')
  })

  test('orçamento vazio dá zero', () => {
    expect(calcularTotalOrcamento({ itens: [], pecas: [] })).toEqual({ subtotal: 0, desconto: 0, total: 0 })
  })

  test('não acumula erro de ponto flutuante', () => {
    expect(
      calcularTotalOrcamento({
        itens: [
          { quantidade: 1, precoUnitario: 0.1 },
          { quantidade: 1, precoUnitario: 0.2 },
        ],
        pecas: [],
      }).total,
    ).toBe(0.3)
  })
})

describe('custo das peças', () => {
  test('soma custo × quantidade', () => {
    expect(
      somarCustoPecas([
        { quantidade: 1, custoUnitario: 280 },
        { quantidade: 2, custoUnitario: 5.5 },
      ]),
    ).toBe(291)
  })

  test('qualquer peça sem custo deixa a soma pendente', () => {
    expect(
      somarCustoPecas([
        { quantidade: 1, custoUnitario: 280 },
        { quantidade: 1, custoUnitario: null },
      ]),
    ).toBeNull()
  })

  test('sem peças, custo zero', () => {
    expect(somarCustoPecas([])).toBe(0)
  })
})

describe('comissão e lucro (exemplo da spec 8.5)', () => {
  test('cobrado 650, peça 280, 30% → comissão 111, sobrou 259', () => {
    const comissao = calcularComissao({ total: 650, custoPecas: 280, percentual: 30 })
    expect(comissao).toBe(111)
    expect(calcularLucro({ total: 650, custoPecas: 280, comissao })).toBe(259)
  })

  test('comissão arredonda ao centavo', () => {
    expect(calcularComissao({ total: 100, custoPecas: 0, percentual: 33.33 })).toBe(33.33)
    expect(calcularComissao({ total: 10, custoPecas: 0, percentual: 12.345 })).toBe(1.23)
  })

  test('peça mais cara que o cobrado não gera comissão negativa', () => {
    expect(calcularComissao({ total: 100, custoPecas: 150, percentual: 30 })).toBe(0)
    expect(calcularLucro({ total: 100, custoPecas: 150, comissao: 0 })).toBe(-50)
  })

  test('sem % de comissão, lucro é total menos peças', () => {
    const comissao = calcularComissao({ total: 650, custoPecas: 280, percentual: 0 })
    expect(comissao).toBe(0)
    expect(calcularLucro({ total: 650, custoPecas: 280, comissao })).toBe(370)
  })
})
