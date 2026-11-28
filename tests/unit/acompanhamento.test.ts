import { describe, expect, test } from 'vitest'
import { lerAcompanhamento, tokenValido } from '@/lib/acompanhamento'

const bruto = {
  loja: { nome: 'Loja do Zé', telefone: '1333334444', endereco: 'Rua A, 1', logo_path: null },
  cliente: 'Maria',
  os: {
    numero: 1042,
    aparelho_tipo: 'celular',
    marca: 'Apple',
    modelo: 'iPhone 11',
    status: 'orcamento_enviado',
    criado_em: '2026-11-28T12:00:00Z',
    encerrada_em: null,
    previsao_entrega: '2026-12-02',
  },
  historico: [
    { para_status: 'aberta', criado_em: '2026-11-28T12:00:00Z' },
    { para_status: 'orcamento_enviado', criado_em: '2026-11-28T13:00:00Z' },
  ],
  orcamento: {
    id: 'ORC1',
    versao: 2,
    status: 'enviado',
    desconto_valor: null,
    desconto_percentual: 10,
    aprovado_em: null,
    recusado_em: null,
    itens: [{ descricao: 'Troca de tela', quantidade: 1, preco_unitario: 300 }],
  },
  pecas: [{ descricao: 'Tela', quantidade: 1, preco_unitario: 350 }],
  pago: 100,
  garantia: null,
}

describe('token do link', () => {
  test('48 caracteres hex minúsculos', () => {
    expect(tokenValido('a'.repeat(48))).toBe(true)
    expect(tokenValido('0123456789abcdef'.repeat(3))).toBe(true)
  })
  test('qualquer outra coisa é recusada antes de ir ao banco', () => {
    expect(tokenValido('a'.repeat(47))).toBe(false)
    expect(tokenValido('A'.repeat(48))).toBe(false)
    expect(tokenValido('g'.repeat(48))).toBe(false)
    expect(tokenValido("' or 1=1 --")).toBe(false)
  })
})

describe('dados do acompanhamento', () => {
  test('link inexistente: null', () => {
    expect(lerAcompanhamento(null)).toBeNull()
  })

  test('monta aparelho, histórico e contas (itens + peças − desconto, menos o pago)', () => {
    const a = lerAcompanhamento(bruto)!
    expect(a.os.aparelho).toBe('Celular · Apple · iPhone 11')
    expect(a.historico.map((h) => h.status)).toEqual(['aberta', 'orcamento_enviado'])
    expect(a.conta).toEqual({ subtotal: 650, desconto: 65, total: 585, pago: 100, falta: 485 })
    expect(a.orcamento?.status).toBe('enviado')
  })

  test('orçamento recusado não cobra nada', () => {
    const a = lerAcompanhamento({ ...bruto, orcamento: { ...bruto.orcamento, status: 'recusado' } })!
    expect(a.conta.total).toBe(0)
  })

  test('sem orçamento enviado ainda: só o andamento', () => {
    const a = lerAcompanhamento({ ...bruto, orcamento: null, pecas: [], pago: 0 })!
    expect(a.orcamento).toBeNull()
    expect(a.conta.total).toBe(0)
  })

  test('garantia vem convertida quando existe', () => {
    const a = lerAcompanhamento({ ...bruto, garantia: { dias: 90, vence_em: '2027-02-26', condicoes: ['Queda'] } })!
    expect(a.garantia).toEqual({ dias: 90, venceEm: '2027-02-26', condicoes: ['Queda'] })
  })
})
