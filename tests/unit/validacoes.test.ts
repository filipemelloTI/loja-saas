import { esquemaServico, esquemaMembro, esquemaConfigLoja, esquemaNovaLoja } from '@/lib/validacoes'

describe('esquemaServico', () => {
  it('rejeita preço negativo', () => {
    expect(esquemaServico.safeParse({ nome: 'Tela', preco: -1, custo: 0 }).success).toBe(false)
  })
  it('aceita válido e garantia opcional', () => {
    expect(esquemaServico.safeParse({ nome: 'Tela', preco: 100, custo: 40 }).success).toBe(true)
    expect(esquemaServico.safeParse({ nome: 'Tela', preco: 100, custo: 40, garantiaDias: 1.5 }).success).toBe(false)
  })
  it('exige nome e limita a 80', () => {
    expect(esquemaServico.safeParse({ nome: '', preco: 1, custo: 0 }).success).toBe(false)
    expect(esquemaServico.safeParse({ nome: 'a'.repeat(81), preco: 1, custo: 0 }).success).toBe(false)
  })
})

describe('esquemaMembro', () => {
  it('rejeita comissão acima de 100', () => {
    expect(esquemaMembro.safeParse({ nome: 'Carlos', email: 'c@x.com', perfil: 'tecnico', comissao: 101 }).success).toBe(false)
  })
  it('rejeita email inválido', () => {
    const r = esquemaMembro.safeParse({ nome: 'Carlos', email: 'x', perfil: 'atendente' })
    expect(r.success).toBe(false)
  })
  it('aceita técnico com comissão', () => {
    expect(esquemaMembro.safeParse({ nome: 'Carlos', email: 'c@x.com', perfil: 'tecnico', comissao: 10 }).success).toBe(true)
  })
  it('aceita comissão para dono', () => {
    expect(esquemaMembro.safeParse({ nome: 'Zé', email: 'z@x.com', perfil: 'dono', comissao: 30 }).success).toBe(true)
  })
  it('rejeita comissão para atendente', () => {
    expect(esquemaMembro.safeParse({ nome: 'Ana', email: 'a@x.com', perfil: 'atendente', comissao: 30 }).success).toBe(false)
  })
})

describe('esquemaConfigLoja', () => {
  const base = {
    garantiaServicoDias: 90, garantiaNovoDias: 365, garantiaSeminovoDias: 90, garantiaAcessorioDias: 30,
    orcamentoAlertaDias: 7, taxaAvaliacaoAtiva: false, taxaAvaliacaoValor: 0,
    osNumeroInicial: 1, vendaNumeroInicial: 1, formasPagamento: ['pix'],
    donoGeraComissao: false, tecnicoVePropriaComissao: true,
  }
  it('aceita válido', () => {
    expect(esquemaConfigLoja.safeParse(base).success).toBe(true)
  })
  it('rejeita número inicial 0 e garantia negativa', () => {
    expect(esquemaConfigLoja.safeParse({ ...base, osNumeroInicial: 0 }).success).toBe(false)
    expect(esquemaConfigLoja.safeParse({ ...base, garantiaNovoDias: -1 }).success).toBe(false)
  })
})

describe('esquemaNovaLoja', () => {
  const base = { nomeLoja: 'Loja', nomeDono: 'Zé', emailDono: 'z@x.com', planoId: 'p1', modulos: ['servico'] }
  it('aceita válido', () => {
    expect(esquemaNovaLoja.safeParse(base).success).toBe(true)
  })
  it('vendas sem estoque falha com mensagem', () => {
    const r = esquemaNovaLoja.safeParse({ ...base, modulos: ['vendas'] })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Vendas exige o módulo Estoque')
  })
})
