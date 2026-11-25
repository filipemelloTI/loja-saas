import type { Metadata } from 'next'
import { Marca } from '@/components/Marca'
import { BotaoEnviar } from '@/components/ui/BotaoEnviar'
import { Cartao } from '@/components/ui/Cartao'
import { sair } from '@/lib/auth-acoes'

export const metadata: Metadata = { title: 'Sem acesso' }

export default function SemAcesso() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <Marca />
      <Cartao titulo="Você ainda não está em uma loja">
        <div className="flex flex-col gap-4">
          <p className="text-pretty text-tinta-suave">
            Seu acesso existe, mas nenhuma loja está ligada a ele. Peça ao dono da loja para
            te cadastrar em <strong className="font-semibold text-tinta">Configurações → Usuários</strong>.
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
