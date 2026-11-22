import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { carregarContextoCom } from '@/lib/contexto'
import { destinoAposLogin } from '@/lib/destino'

// Next 16: "middleware" foi renomeado para "proxy".
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(lista, headers) {
          lista.forEach(({ name, value }) => request.cookies.set(name, value))
          resposta = NextResponse.next({ request })
          lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options))
          Object.entries(headers ?? {}).forEach(([k, v]) => resposta.headers.set(k, v))
        },
      },
    },
  )

  const ctx = await carregarContextoCom(supabase)
  const destino = destinoAposLogin(ctx, request.nextUrl.pathname)
  if (destino && destino !== request.nextUrl.pathname) {
    const redirecionar = NextResponse.redirect(new URL(destino, request.url))
    resposta.cookies.getAll().forEach((c) => redirecionar.cookies.set(c))
    return redirecionar
  }
  return resposta
}

// Next exige que `config` seja literal estático, então o padrão vive em `src/lib/matcher.ts`
// (testado) e é repetido aqui; o teste confere que os dois são idênticos.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
