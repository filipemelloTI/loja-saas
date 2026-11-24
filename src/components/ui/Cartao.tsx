import type { ReactNode } from 'react'

type Props = {
  titulo?: string
  /** Ações à direita do título (ex.: botão "Novo"). */
  acoes?: ReactNode
  children: ReactNode
  className?: string
}

export function Cartao({ titulo, acoes, children, className = '' }: Props) {
  return (
    <section className={`rounded-xl border border-linha bg-superficie p-4 sm:p-5 ${className}`.trim()}>
      {(titulo || acoes) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {titulo && <h2 className="font-titulo text-lg font-semibold text-tinta">{titulo}</h2>}
          {acoes}
        </div>
      )}
      {children}
    </section>
  )
}
