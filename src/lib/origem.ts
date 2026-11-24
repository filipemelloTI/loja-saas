import 'server-only'
import { headers } from 'next/headers'

/**
 * Origem do site (para links enviados ao usuário). Quando `NEXT_PUBLIC_SITE_URL`
 * está definida, ela sempre vale (produção e desenvolvimento). Sem ela, cair para os
 * cabeçalhos da requisição (`x-forwarded-host`/`host`) é inseguro — um Host forjado
 * apontaria o link de definir senha, com token válido, para o domínio do atacante —,
 * então em produção falhamos fechado; o fallback por cabeçalho só vale em
 * desenvolvimento (localhost), por conveniência.
 */
export async function origemDoSite(): Promise<string> {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL
  if (configurada) return configurada.replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SITE_URL não configurada — defina o domínio do site antes de gerar links.')
  }
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const protocolo = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocolo}://${host}`
}
