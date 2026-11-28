import type { Evento } from '@/lib/mensagens'
import type { StatusOS } from '@/lib/os-status'

/**
 * Aviso ao cliente pelo WhatsApp da própria loja (spec 8.8): só um link `wa.me` que abre o
 * aplicativo com a mensagem pronta. Nada é enviado automaticamente, e o número da loja não
 * passa por API nenhuma.
 */

/** Número no formato do `wa.me` (55 + DDD + número), ou `null` se o telefone não fecha. */
export function numeroWhatsApp(telefone: string | null | undefined): string | null {
  const d = (telefone ?? '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  return null
}

/** Troca `{variavel}` pelo valor. Variável sem valor some (nunca vai `{link}` cru para o cliente). */
export function preencherMensagem(texto: string, valores: Partial<Record<string, string | null>>): string {
  return texto
    .replace(/\{(\w+)\}/g, (_, chave: string) => valores[chave] ?? '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,!?])/g, '$1')
    .trim()
}

export function linkWhatsApp(telefone: string | null | undefined, texto: string): string | null {
  const numero = numeroWhatsApp(telefone)
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null
}

/** Qual aviso combina com a etapa atual da OS. */
export function eventoDaEtapa(status: StatusOS): Evento | null {
  switch (status) {
    case 'aberta':
    case 'em_analise':
      return 'os_aberta'
    case 'orcamento_enviado':
      return 'orcamento_enviado'
    case 'aguardando_peca':
      return 'aguardando_peca'
    case 'pronto':
    case 'pronto_devolucao':
      return 'pronto'
    case 'entregue':
      return 'entregue'
    case 'devolvido':
      return 'devolvido'
    default:
      return null
  }
}
