import { podeAcessar, validarModulos } from '@/lib/permissoes'

describe('podeAcessar', () => {
  it('técnico não acessa configurações, fornecedores nem financeiro', () => {
    expect(podeAcessar('tecnico', 'configuracoes')).toBe(false)
    expect(podeAcessar('tecnico', 'fornecedores')).toBe(false)
    expect(podeAcessar('tecnico', 'financeiro')).toBe(false)
  })
  it('técnico acessa serviço, clientes e estoque', () => {
    expect(podeAcessar('tecnico', 'servico')).toBe(true)
    expect(podeAcessar('tecnico', 'clientes')).toBe(true)
    expect(podeAcessar('tecnico', 'estoque')).toBe(true)
  })
  it('atendente acessa vendas mas não financeiro', () => {
    expect(podeAcessar('atendente', 'vendas')).toBe(true)
    expect(podeAcessar('atendente', 'financeiro')).toBe(false)
  })
  it('dono acessa tudo', () => {
    for (const a of ['servico', 'estoque', 'vendas', 'fornecedores', 'financeiro', 'clientes', 'configuracoes'] as const) {
      expect(podeAcessar('dono', a)).toBe(true)
    }
  })
})

describe('validarModulos', () => {
  it('vendas exige estoque', () => {
    expect(validarModulos(['vendas'])).toEqual({ ok: false, erro: 'Vendas exige o módulo Estoque' })
  })
  it('aceita combinações válidas', () => {
    expect(validarModulos(['vendas', 'estoque'])).toEqual({ ok: true })
    expect(validarModulos([])).toEqual({ ok: true })
  })
})
