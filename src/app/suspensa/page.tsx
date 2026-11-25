import type { Metadata } from 'next'
import { Marca } from '@/components/Marca'
import { BotaoEnviar } from '@/components/ui/BotaoEnviar'
import { Cartao } from '@/components/ui/Cartao'
import { sair } from '@/lib/auth-acoes'

export const metadata: Metadata = { title: 'Acesso suspenso' }

export default function Suspensa() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <Marca />
      <Cartao titulo="Acesso suspenso">
        <div className="flex flex-col gap-4">
          <p className="text-pretty text-tinta-suave">
            O acesso desta loja está suspenso no momento. Seus dados continuam guardados —
            fale com o suporte para reativar.
          </p>
          <form action={sair}>
            <BotaoEnviar variante="secundario" rotuloCarregando="Saindo…">
              Sair
            </BotaoEnviar>
          </form>
        </div>
      </Cartao>
    </main>
  )
}
