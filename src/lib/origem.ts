import 'server-only'
import { headers } from 'next/headers'

/** Origem do site (para links enviados ao usuário): variável de ambiente ou cabeçalhos da requisição. */
export async function origemDoSite(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const protocolo = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocolo}://${host}`
}
