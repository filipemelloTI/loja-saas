import { areaLiberada, perfilEfetivo } from '@/lib/guarda'
import { itensMenu } from '@/lib/menu'
import type { Area, Modulo, Perfil } from '@/lib/tipos'

const TODOS: Modulo[] = ['servico', 'estoque', 'vendas', 'fornecedores', 'financeiro']
const AREAS: Area[] = ['servico', 'clientes', 'estoque', 'vendas', 'fornecedores', 'financeiro', 'configuracoes']

describe('areaLiberada', () => {
  it('técnico não entra em Configurações, mesmo digitando a URL', () => {
    expect(areaLiberada('tecnico', TODOS, 'configuracoes')).toBe(false)
  })
  it('técnico entra em Serviço quando o módulo está ligado', () => {
    expect(areaLiberada('tecnico', TODOS, 'servico')).toBe(true)
  })
  it('módulo desligado bloqueia até o dono', () => {
    expect(areaLiberada('dono', ['servico'], 'financeiro')).toBe(false)
    expect(areaLiberada('dono', [], 'servico')).toBe(false)
  })
  it('Clientes e Configurações não dependem de módulo', () => {
    expect(areaLiberada('dono', [], 'clientes')).toBe(true)
    expect(areaLiberada('dono', [], 'configuracoes')).toBe(true)
  })
  it('atendente entra em Vendas mas não em Financeiro', () => {
    expect(areaLiberada('atendente', TODOS, 'vendas')).toBe(true)
    expect(areaLiberada('atendente', TODOS, 'financeiro')).toBe(false)
  })
  it('bate com o menu: libera exatamente as áreas que aparecem nele', () => {
    const perfis: Perfil[] = ['dono', 'tecnico', 'atendente']
    const combinacoes: Modulo[][] = [[], ['servico'], ['estoque', 'vendas'], TODOS]
    for (const perfil of perfis) {
      for (const modulos of combinacoes) {
        const noMenu = itensMenu(perfil, modulos).map((i) => i.area)
        for (const area of AREAS) {
          expect(areaLiberada(perfil, modulos, area), `${perfil} ${modulos.join(',')} ${area}`)
            .toBe(noMenu.includes(area))
        }
      }
    }
  })
})

describe('perfilEfetivo', () => {
  it('usa o perfil do membro', () => {
    expect(perfilEfetivo({ membro: { perfil: 'tecnico' }, emSuporte: false })).toBe('tecnico')
  })
  it('admin em suporte (sem membro) vê como dono', () => {
    expect(perfilEfetivo({ membro: null, emSuporte: true })).toBe('dono')
  })
  it('sem membro e sem suporte não tem perfil', () => {
    expect(perfilEfetivo({ membro: null, emSuporte: false })).toBeNull()
  })
})
