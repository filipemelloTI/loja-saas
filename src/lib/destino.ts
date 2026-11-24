import type { Contexto } from '@/lib/contexto'

const igualOuSub = (rota: string, base: string) => rota === base || rota.startsWith(base + '/')

/** Decide para onde redirecionar. `null` = seguir na rota pedida. Função pura. */
export function destinoAposLogin(ctx: Contexto | null, rotaPedida: string): string | null {
  const publicaSempre = igualOuSub(rotaPedida, '/definir-senha') || rotaPedida.startsWith('/acompanhar/')
  if (publicaSempre) return null

  if (!ctx) return rotaPedida === '/login' ? null : '/login'

  // Admin fora do modo suporte: só a área da plataforma.
  if (ctx.adminPlataforma && !ctx.emSuporte) {
    return igualOuSub(rotaPedida, '/plataforma') ? null : '/plataforma'
  }

  // Admin em suporte entra nas rotas da loja (mesmo suspensa, para atender).
  if (ctx.adminPlataforma && ctx.emSuporte) {
    return rotaPedida === '/login' ? '/' : null
  }

  // Usuário de loja.
  // Loja suspensa primeiro: a RLS esconde o membro nesse caso, mas a loja é conhecida.
  if (ctx.loja?.situacao === 'suspensa') {
    return rotaPedida === '/suspensa' ? null : '/suspensa'
  }
  if (!ctx.membro || !ctx.membro.ativo || !ctx.loja) {
    return rotaPedida === '/sem-acesso' ? null : '/sem-acesso'
  }
  if (
    rotaPedida === '/login' ||
    rotaPedida === '/suspensa' ||
    rotaPedida === '/sem-acesso' ||
    igualOuSub(rotaPedida, '/plataforma')
  ) {
    return '/'
  }
  return null
}
