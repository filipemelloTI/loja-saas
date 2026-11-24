import type { Area, Modulo, Perfil } from './tipos'

const PERMITIDAS: Record<Exclude<Perfil, 'dono'>, Area[]> = {
  tecnico: ['servico', 'clientes', 'estoque'],
  atendente: ['servico', 'clientes', 'estoque', 'vendas'],
}

export function podeAcessar(perfil: Perfil, area: Area): boolean {
  if (perfil === 'dono') return true
  return PERMITIDAS[perfil].includes(area)
}

export function validarModulos(modulos: Modulo[]): { ok: true } | { ok: false; erro: string } {
  if (modulos.includes('vendas') && !modulos.includes('estoque')) {
    return { ok: false, erro: 'Vendas exige o módulo Estoque' }
  }
  return { ok: true }
}
