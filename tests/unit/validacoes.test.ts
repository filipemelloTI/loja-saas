import {
  esquemaServico, esquemaMembro, esquemaConfigLoja, esquemaNovaLoja,
  esquemaCliente, esquemaNovaOS, esquemaLaudo, cpfValido,
} from '@/lib/validacoes'

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

describe('cpfValido', () => {
  it('aceita CPF válido, com ou sem máscara', () => {
    expect(cpfValido('52998224725')).toBe(true)
    expect(cpfValido('529.982.247-25')).toBe(true)
  })
  it('recusa dígito verificador errado', () => {
    expect(cpfValido('52998224726')).toBe(false)
    expect(cpfValido('52998224715')).toBe(false)
  })
  it('recusa sequência repetida', () => {
    expect(cpfValido('11111111111')).toBe(false)
  })
  it('recusa tamanho errado', () => {
    expect(cpfValido('5299822472')).toBe(false)
    expect(cpfValido('529982247250')).toBe(false)
    expect(cpfValido('')).toBe(false)
  })
})

describe('esquemaCliente', () => {
  const base = { nome: 'Ana', telefone: '13999999999' }
  it('cliente exige nome e telefone', () => {
    expect(esquemaCliente.safeParse({ nome: '', telefone: '13999999999' }).success).toBe(false)
    expect(esquemaCliente.safeParse({ nome: 'Ana', telefone: '' }).success).toBe(false)
  })
  it('aponta o campo que falhou', () => {
    const r = esquemaCliente.safeParse({ nome: '  ', telefone: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path[0])
      expect(campos).toContain('nome')
      expect(campos).toContain('telefone')
    }
  })
  it('CPF é opcional, mas inválido é recusado', () => {
    expect(esquemaCliente.safeParse(base).success).toBe(true)
    const r = esquemaCliente.safeParse({ ...base, cpf: '111.111.111-11' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(['cpf'])
      expect(r.error.issues[0].message).toBe('CPF inválido')
    }
  })
  it('aceita CPF válido e os demais campos opcionais', () => {
    const r = esquemaCliente.safeParse({
      ...base, cpf: '529.982.247-25', email: 'ana@x.com', endereco: 'Rua A, 1', nascimento: '1990-05-17',
    })
    expect(r.success).toBe(true)
  })
  it('campos opcionais em branco viram undefined', () => {
    for (const vazio of ['', '   ']) {
      const r = esquemaCliente.safeParse({ ...base, cpf: vazio, email: vazio, endereco: vazio, nascimento: vazio })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.cpf).toBeUndefined()
        expect(r.data.email).toBeUndefined()
        expect(r.data.endereco).toBeUndefined()
        expect(r.data.nascimento).toBeUndefined()
      }
    }
  })
  it('endereço preenchido é aparado', () => {
    const r = esquemaCliente.parse({ ...base, endereco: '  Rua A, 1  ' })
    expect(r.endereco).toBe('Rua A, 1')
  })
  it('recusa e-mail inválido quando informado', () => {
    const r = esquemaCliente.safeParse({ ...base, email: 'x' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toEqual(['email'])
  })
})

describe('esquemaNovaOS', () => {
  const base = { aparelhoTipo: 'celular', defeitoRelatado: 'Tela trincada' }
  const motivo = (dados: unknown) => {
    const r = esquemaNovaOS.safeParse(dados)
    if (r.success) return null
    return { path: r.error.issues[0].path, message: r.error.issues[0].message }
  }
  it('OS normal exige cliente', () => {
    expect(motivo({ ...base, interna: false })).toEqual({ path: ['clienteId'], message: 'Escolha o cliente' })
  })
  it('OS interna recusa cliente', () => {
    expect(motivo({ ...base, interna: true, clienteId: 'x' })).toEqual({ path: ['clienteId'], message: 'OS interna não tem cliente' })
  })
  it('cliente em branco ou só espaços conta como sem cliente', () => {
    for (const clienteId of ['', '   ']) {
      expect(motivo({ ...base, interna: false, clienteId })).toEqual({ path: ['clienteId'], message: 'Escolha o cliente' })
      expect(esquemaNovaOS.safeParse({ ...base, interna: true, clienteId }).success).toBe(true)
    }
  })
  it('campos opcionais em branco viram undefined', () => {
    const r = esquemaNovaOS.safeParse({
      ...base, interna: true, marca: '  ', modelo: '', cor: ' ', imei: '', observacao: '  ', previsaoEntrega: '',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect([r.data.marca, r.data.modelo, r.data.cor, r.data.imei, r.data.observacao, r.data.previsaoEntrega]).toEqual(Array(6).fill(undefined))
    }
  })
  it('técnico e senha em branco viram undefined', () => {
    for (const vazio of ['', '   ']) {
      const r = esquemaNovaOS.safeParse({ ...base, interna: true, tecnicoId: vazio, senhaAparelho: vazio })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.tecnicoId).toBeUndefined()
        expect(r.data.senhaAparelho).toBeUndefined()
      }
    }
  })
  it('mantém técnico e senha preenchidos', () => {
    const r = esquemaNovaOS.parse({ ...base, interna: true, tecnicoId: 't1', senhaAparelho: ' 12 34 ' })
    expect(r.tecnicoId).toBe('t1')
    expect(r.senhaAparelho).toBe(' 12 34 ')
  })
  it('apara marca preenchida', () => {
    expect(esquemaNovaOS.parse({ ...base, interna: true, marca: '  Apple ' }).marca).toBe('Apple')
  })
  it('item de checklist sem nome é recusado', () => {
    for (const nome of ['', '  ']) {
      const r = esquemaNovaOS.safeParse({ ...base, interna: true, checklist: [{ nome, marcado: true }] })
      expect(r.success).toBe(false)
      if (!r.success) {
        expect(r.error.issues[0].path).toEqual(['checklist', 0, 'nome'])
        expect(r.error.issues[0].message).toBe('Informe o nome do item')
      }
    }
  })
  it('aceita OS normal com cliente e OS interna sem cliente', () => {
    expect(esquemaNovaOS.safeParse({ ...base, interna: false, clienteId: 'c1' }).success).toBe(true)
    expect(esquemaNovaOS.safeParse({ ...base, interna: true }).success).toBe(true)
  })
  it('aceita OS completa', () => {
    const r = esquemaNovaOS.safeParse({
      ...base, interna: false, clienteId: 'c1', acessorios: ['capa', 'carregador'],
      checklist: [{ nome: 'Liga', marcado: true }, { nome: 'Câmera', marcado: false, observacao: 'risco' }],
      previsaoEntrega: '2026-12-01', senhaAparelho: '1234',
    })
    expect(r.success).toBe(true)
  })
  it('aceita todos os tipos do banco', () => {
    for (const t of ['celular', 'tablet', 'relogio', 'notebook', 'outro']) {
      expect(esquemaNovaOS.safeParse({ ...base, aparelhoTipo: t, interna: true }).success).toBe(true)
    }
  })
  it('recusa tipo de aparelho fora do enum', () => {
    expect(motivo({ ...base, aparelhoTipo: 'relógio', interna: true })?.path).toEqual(['aparelhoTipo'])
    expect(motivo({ ...base, aparelhoTipo: 'geladeira', interna: true })?.path).toEqual(['aparelhoTipo'])
  })
  it('exige o defeito relatado', () => {
    expect(motivo({ aparelhoTipo: 'celular', defeitoRelatado: '  ', interna: true })?.path).toEqual(['defeitoRelatado'])
  })
  it('recusa previsão de entrega que não é data', () => {
    expect(motivo({ ...base, interna: true, previsaoEntrega: 'amanhã' })?.path).toEqual(['previsaoEntrega'])
  })
})

describe('esquemaLaudo', () => {
  it('recusa laudo vazio ou só espaços', () => {
    for (const laudo of ['', '   ']) {
      const r = esquemaLaudo.safeParse({ laudo })
      expect(r.success).toBe(false)
      if (!r.success) {
        expect(r.error.issues[0].path).toEqual(['laudo'])
        expect(r.error.issues[0].message).toBe('Escreva o laudo')
      }
    }
  })
  it('aceita texto e não impõe limite', () => {
    expect(esquemaLaudo.parse({ laudo: '  Placa oxidada  ' }).laudo).toBe('Placa oxidada')
    expect(esquemaLaudo.safeParse({ laudo: 'a'.repeat(20000) }).success).toBe(true)
  })
})
