import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { carregarContexto } from '@/lib/contexto'
import { areaLiberada, perfilEfetivo } from '@/lib/guarda'
import type { Area } from '@/lib/tipos'

/**
 * Contexto lido uma vez por requisição (layout e página compartilham).
 * `connection()` vem antes: com Cache Components, o cliente Supabase usa `Date.now()`
 * ao carregar, e isso só é permitido depois de marcar a leitura como de requisição.
 */
export const contextoAtual = cache(async () => {
  await connection()
  return carregarContexto()
})

/**
 * Guarda de área para páginas da loja: quem digitar a URL de uma área que não pode
 * ver (perfil ou módulo desligado) volta para o Início.
 */
export async function exigirArea(area: Area) {
  const ctx = await contextoAtual()
  const perfil = ctx ? perfilEfetivo(ctx) : null
  if (!ctx?.loja || !perfil || !areaLiberada(perfil, ctx.loja.modulos, area)) redirect('/')
  return ctx
}
