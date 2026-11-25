import { Suspense, type ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { MenuInferior, MenuLateral } from '@/components/MenuLoja'
import { BotaoEnviar } from '@/components/ui/BotaoEnviar'
import { Icone } from '@/components/Icone'
import { contextoAtual } from '@/lib/sessao'
import { perfilEfetivo } from '@/lib/guarda'
import { itensMenu } from '@/lib/menu'
import { sair } from '@/lib/auth-acoes'
import { NOME_SISTEMA } from '@/lib/marca'
import type { Perfil } from '@/lib/tipos'

const NOME_PERFIL: Record<Perfil, string> = { dono: 'Dono', tecnico: 'Técnico', atendente: 'Atendente' }

/**
 * A sessão é lida em tempo de requisição, então tudo que depende dela fica atrás do
 * <Suspense>. O esqueleto usa a mesma moldura, com as mesmas alturas, para não pular.
 */
export default function LayoutLoja({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<Moldura />}>
      <Casca>{children}</Casca>
    </Suspense>
  )
}

async function Casca({ children }: { children: ReactNode }) {
  const ctx = await contextoAtual()
  const perfil = ctx ? perfilEfetivo(ctx) : null
  if (!ctx?.loja || !perfil) redirect('/login') // o proxy já cobre; aqui é só garantia

  const itens = itensMenu(perfil, ctx.loja.modulos)
  const quem = ctx.membro ? `${ctx.membro.nome}, ${NOME_PERFIL[perfil].toLowerCase()}` : 'Atendimento da plataforma'

  return (
    <Moldura
      suporte={ctx.emSuporte}
      lateral={<MenuLateral itens={itens} />}
      inferior={<MenuInferior itens={itens} />}
      topo={
        <>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate font-titulo text-lg font-semibold leading-tight lg:text-xl">{ctx.loja.nome}</p>
            <p className="sobrancelha truncate">{quem}</p>
          </div>
          <form action={sair}>
            <BotaoEnviar variante="discreto" rotuloCarregando="Saindo…">
              <Icone nome="sair" className="size-5" />
              Sair
            </BotaoEnviar>
          </form>
        </>
      }
    >
      {children}
    </Moldura>
  )
}

type PropsMoldura = {
  suporte?: boolean
  topo?: ReactNode
  lateral?: ReactNode
  inferior?: ReactNode
  children?: ReactNode
}

function Moldura({ suporte, topo, lateral, inferior, children }: PropsMoldura) {
  return (
    // Celular: a página rola inteira. Computador: só a coluna de conteúdo rola; a barra lateral fica parada.
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      {suporte && (
        <p role="status" className="sticky top-0 z-40 bg-sinal px-4 py-2 text-center text-sm font-semibold text-sobre-sinal lg:static">
          Modo suporte — somente leitura
        </p>
      )}
      <div className="flex flex-1 lg:min-h-0">
        <aside className="hidden w-60 shrink-0 flex-col gap-6 overflow-y-auto bg-trilho px-3 py-5 lg:flex">
          <p className="px-3 font-titulo text-lg font-bold tracking-tight text-marca">{NOME_SISTEMA}</p>
          {lateral}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col lg:overflow-y-auto">
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-linha bg-superficie px-4 lg:px-8">
            {topo}
          </header>
          <main className="flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pb-10">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
      {inferior ?? <div aria-hidden="true" className="fixed inset-x-0 bottom-0 h-14 border-t border-linha bg-superficie lg:hidden" />}
    </div>
  )
}
