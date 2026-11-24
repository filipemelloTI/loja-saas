'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'
import { Icone, type NomeIcone } from '@/components/Icone'

export type ItemMenu = { area: string; rotulo: string; href: string }

/** Na barra do celular cabem 5 botões: com mais itens, os 4 primeiros + "Mais". */
const NA_BARRA = 4

const ativo = (rota: string, href: string) => (href === '/' ? rota === '/' : rota === href || rota.startsWith(href + '/'))
const icone = (area: string) => area as NomeIcone

export function MenuLateral({ itens }: { itens: ItemMenu[] }) {
  const rota = usePathname()
  return (
    <nav aria-label="Menu principal">
      <ul className="flex flex-col gap-1">
        {itens.map((i) => {
          const atual = ativo(rota, i.href)
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={atual ? 'page' : undefined}
                className={
                  'relative flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium transition-colors ' +
                  (atual
                    ? 'bg-trilho-ativo text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r before:bg-sinal'
                    : 'text-sobre-trilho hover:bg-trilho-ativo hover:text-white')
                }
              >
                <Icone nome={icone(i.area)} className={`size-5 ${atual ? 'text-sinal' : 'text-sobre-trilho-suave'}`} />
                {i.rotulo}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function MenuInferior({ itens }: { itens: ItemMenu[] }) {
  const rota = usePathname()
  const folha = useRef<HTMLDivElement>(null)
  const cabeTudo = itens.length <= NA_BARRA + 1
  const naBarra = cabeTudo ? itens : itens.slice(0, NA_BARRA)
  const resto = cabeTudo ? [] : itens.slice(NA_BARRA)
  const maisAtivo = resto.some((i) => ativo(rota, i.href))

  const botao = (atual: boolean) =>
    'relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold ' +
    (atual
      ? 'text-marca before:absolute before:inset-x-4 before:top-0 before:h-1 before:rounded-b before:bg-sinal'
      : 'text-tinta-suave')

  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-superficie pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid auto-cols-fr grid-flow-col">
        {naBarra.map((i) => {
          const atual = ativo(rota, i.href)
          return (
            <li key={i.href}>
              <Link href={i.href} aria-current={atual ? 'page' : undefined} className={botao(atual)}>
                <Icone nome={icone(i.area)} />
                {i.rotulo}
              </Link>
            </li>
          )
        })}
        {resto.length > 0 && (
          <li>
            <button type="button" popoverTarget="menu-mais" className={botao(maisAtivo)}>
              <Icone nome="mais" />
              Mais
            </button>
          </li>
        )}
      </ul>

      {resto.length > 0 && (
        <div
          ref={folha}
          id="menu-mais"
          popover="auto"
          aria-label="Mais opções"
          className="inset-x-0 top-auto bottom-[calc(3.5rem+env(safe-area-inset-bottom))] m-0 w-full max-w-none rounded-t-2xl border-t border-linha bg-superficie p-2 text-tinta shadow-[0_-8px_24px_rgb(0_0_0/0.12)] backdrop:bg-black/30"
        >
          <ul className="flex flex-col">
            {resto.map((i) => {
              const atual = ativo(rota, i.href)
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={atual ? 'page' : undefined}
                    onClick={() => folha.current?.hidePopover()}
                    className={
                      'flex min-h-12 items-center gap-3 rounded-lg px-3 font-medium ' +
                      (atual ? 'bg-marca-suave text-marca-forte' : 'hover:bg-superficie-2')
                    }
                  >
                    <Icone nome={icone(i.area)} className={`size-5 ${atual ? '' : 'text-tinta-suave'}`} />
                    {i.rotulo}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </nav>
  )
}
