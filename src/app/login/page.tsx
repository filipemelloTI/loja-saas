import { Suspense } from 'react'
import { entrar } from '@/lib/auth-acoes'

async function Erro({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  return erro ? <p role="alert" className="text-red-600">E-mail ou senha incorretos.</p> : null
}

export default function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <Suspense>
        <Erro searchParams={searchParams} />
      </Suspense>
      <form action={entrar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          E-mail
          <input name="email" type="email" required autoComplete="email" className="rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1">
          Senha
          <input name="senha" type="password" required autoComplete="current-password" className="rounded border p-2" />
        </label>
        <button type="submit" className="rounded bg-black p-2 text-white">Entrar</button>
      </form>
    </main>
  )
}
