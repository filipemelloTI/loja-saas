'use server'

import { carregarOS } from './dados'

/**
 * Entrega a senha do aparelho só quando o balcão pede ("Mostrar senha"). A página nunca a leva no
 * HTML nem no payload inicial. Quem decide se há o que mostrar é `carregarOS` (perfil e OS aberta).
 */
export async function revelarSenha(osId: string): Promise<string | null> {
  const { os, somenteLeitura } = await carregarOS(String(osId))
  return somenteLeitura ? null : (os?.senhaAparelho ?? null)
}
