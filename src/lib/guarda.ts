import type { Area, Modulo, Perfil } from './tipos'
import { podeAcessar } from './permissoes'

/** Áreas que existem em toda loja, sem depender de módulo contratado. */
const SEMPRE_LIGADAS: Area[] = ['clientes', 'configuracoes']

/** A área abre para este perfil nesta loja? Mesma regra do menu. Função pura. */
export function areaLiberada(perfil: Perfil, modulosLoja: Modulo[], area: Area): boolean {
  const ligada = SEMPRE_LIGADAS.includes(area) || modulosLoja.includes(area as Modulo)
  return ligada && podeAcessar(perfil, area)
}

/** Perfil usado para menu e guardas. Admin em suporte não é membro: vê como dono (somente leitura). */
export function perfilEfetivo(ctx: { membro: { perfil: Perfil } | null; emSuporte: boolean }): Perfil | null {
  if (ctx.membro) return ctx.membro.perfil
  return ctx.emSuporte ? 'dono' : null
}
