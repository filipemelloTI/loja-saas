import type { Area, Modulo, Perfil } from './tipos'
import { areaLiberada } from './guarda'

type Item = { area: Area | 'inicio'; rotulo: string; href: string }

const ITENS: Item[] = [
  { area: 'inicio', rotulo: 'Início', href: '/' },
  { area: 'servico', rotulo: 'Serviço', href: '/servico' },
  { area: 'clientes', rotulo: 'Clientes', href: '/clientes' },
  { area: 'estoque', rotulo: 'Estoque', href: '/estoque' },
  { area: 'vendas', rotulo: 'Vendas', href: '/vendas' },
  { area: 'fornecedores', rotulo: 'Fornecedores', href: '/fornecedores' },
  { area: 'financeiro', rotulo: 'Financeiro', href: '/financeiro' },
  { area: 'configuracoes', rotulo: 'Configurações', href: '/configuracoes' },
]

/** Itens do menu na ordem fixa. Mesma regra da guarda de rota (`areaLiberada`). */
export function itensMenu(perfil: Perfil, modulosLoja: Modulo[]): { area: Area; rotulo: string; href: string }[] {
  return ITENS.filter((i) => i.area === 'inicio' || areaLiberada(perfil, modulosLoja, i.area))
    .map(({ area, rotulo, href }) => ({ area: area as Area, rotulo, href }))
}
