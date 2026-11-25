import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Marca } from '@/components/Marca'
import { Alerta } from '@/components/ui/Avisos'
import { BotaoEnviar } from '@/components/ui/BotaoEnviar'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { entrar } from '@/lib/auth-acoes'

export const metadata: Metadata = { title: 'Entrar' }

async function Erro({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  return erro ? <Alerta>E-mail ou senha incorretos.</Alerta> : null
}

export default function Login({ searchParams }: PageProps<'/login'>) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <Marca comDescricao />
      <Cartao titulo="Entrar">
        <form action={entrar} className="flex flex-col gap-4">
          <Suspense>
            <Erro searchParams={searchParams} />
          </Suspense>
          <Campo
            name="email"
            rotulo="E-mail"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
          />
          <Campo
            name="senha"
            rotulo="Senha"
            type="password"
            required
            autoComplete="current-password"
          />
          <BotaoEnviar rotuloCarregando="Entrando…" className="w-full">
            Entrar
          </BotaoEnviar>
        </form>
      </Cartao>
      <p className="text-center text-sm text-tinta-suave">
        Não tem acesso? Peça o link para o dono da loja.
      </p>
    </main>
  )
}
