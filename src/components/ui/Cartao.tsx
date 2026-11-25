import type { ReactNode } from 'react'

type Props = {
  titulo?: string
  /** Rótulo curto acima do título, em mono caixa-alta (ex.: "Hoje", "Resumo"). */
  etiqueta?: string
  /** Ações à direita do título (ex.: botão "Novo"). */
  acoes?: ReactNode
  children: ReactNode
  className?: string
}

export function Cartao({ titulo, etiqueta, acoes, children, className = '' }: Props) {
  return (
    <section
      className={`realce rounded-xl border border-linha bg-superficie p-4 sm:p-5 ${className}`.trim()}
    >
      {(titulo || etiqueta || acoes) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            {etiqueta && <p className="sobrancelha">{etiqueta}</p>}
            {titulo && <h2 className="font-titulo text-lg font-semibold text-tinta">{titulo}</h2>}
          </div>
          {acoes}
        </div>
      )}
      {children}
    </section>
  )
}

/** Rótulo curto de seção, fora de cartão. Mesma voz do `etiqueta` do Cartao. */
export function Sobrancelha({ children }: { children: ReactNode }) {
  return <p className="sobrancelha">{children}</p>
}
