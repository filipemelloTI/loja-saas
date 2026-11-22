import type { Area, Modulo, Perfil } from './tipos'
import { podeAcessar } from './permissoes'

type Item = { area: Area | 'inicio'; rotulo: string; href: string; sempre: boolean }

const ITENS: Item[] = [
  { area: 'inicio', rotulo: 'Início', href: '/', sempre: true },
  { area: 'servico', rotulo: 'Serviço', href: '/servico', sempre: false },
  { area: 'clientes', rotulo: 'Clientes', href: '/clientes', sempre: true },
  { area: 'estoque', rotulo: 'Estoque', href: '/estoque', sempre: false },
  { area: 'vendas', rotulo: 'Vendas', href: '/vendas', sempre: false },
  { area: 'fornecedores', rotulo: 'Fornecedores', href: '/fornecedores', sempre: false },
  { area: 'financeiro', rotulo: 'Financeiro', href: '/financeiro', sempre: false },
  { area: 'configuracoes', rotulo: 'Configurações', href: '/configuracoes', sempre: true },
]

export function itensMenu(perfil: Perfil, modulosLoja: Modulo[]): { area: Area; rotulo: string; href: string }[] {
  return ITENS.filter((i) => {
    if (i.area === 'inicio') return true
    return (i.sempre || modulosLoja.includes(i.area as Modulo)) && podeAcessar(perfil, i.area)
  }).map(({ area, rotulo, href }) => ({ area: area as Area, rotulo, href }))
}
