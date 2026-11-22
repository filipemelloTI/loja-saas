import { Icone } from '@/components/Icone'
import { sair } from '@/lib/auth-acoes'
import { NOME_SISTEMA } from '@/lib/marca'
import { NavPlataforma } from './componentes'

/**
 * Casca do painel da plataforma. Não lê a sessão: cada página confere o admin
 * (`exigirAdminPlataforma`) atrás do próprio <Suspense>, e o proxy já desvia quem não é admin.
 */
export default function LayoutPlataforma({ children }: LayoutProps<'/plataforma'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-linha bg-superficie">
        <div className="mx-auto flex min-h-16 max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 lg:px-8">
          <div className="min-w-0">
            <p className="truncate font-titulo text-lg font-semibold leading-tight">{NOME_SISTEMA}</p>
            <p className="truncate text-sm text-tinta-suave">Painel da plataforma</p>
          </div>
          <div className="flex items-center gap-2">
            <NavPlataforma />
            <form action={sair}>
              <button
                type="submit"
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold text-tinta-suave hover:bg-superficie-2 hover:text-tinta"
              >
                <Icone nome="sair" className="size-5" />
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 pt-6 pb-10 lg:px-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
