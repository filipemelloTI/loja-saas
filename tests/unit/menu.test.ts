import { itensMenu } from '@/lib/menu'

describe('itensMenu', () => {
  it('técnico vê só o que pode, na ordem fixa', () => {
    expect(itensMenu('tecnico', ['servico', 'estoque', 'vendas', 'fornecedores', 'financeiro']).map((i) => i.rotulo))
      .toEqual(['Início', 'Serviço', 'Clientes', 'Estoque'])
  })
  it('dono só vê módulos ligados na loja', () => {
    expect(itensMenu('dono', ['servico']).map((i) => i.rotulo))
      .toEqual(['Início', 'Serviço', 'Clientes', 'Configurações'])
  })
  it('hrefs corretos', () => {
    const itens = itensMenu('dono', ['servico', 'estoque', 'vendas', 'fornecedores', 'financeiro'])
    expect(itens.map((i) => i.href)).toEqual([
      '/', '/servico', '/clientes', '/estoque', '/vendas', '/fornecedores', '/financeiro', '/configuracoes',
    ])
  })
})
