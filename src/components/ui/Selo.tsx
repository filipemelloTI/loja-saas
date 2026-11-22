import type { ReactNode } from 'react'

export type TomSelo = 'neutro' | 'info' | 'aviso' | 'perigo'

const TONS: Record<TomSelo, string> = {
  neutro: 'bg-superficie-2 text-tinta-suave',
  info: 'bg-marca-suave text-marca-forte',
  aviso: 'bg-sinal-suave text-sobre-sinal-suave',
  perigo: 'bg-perigo-suave text-sobre-perigo-suave',
}

/** Etiqueta curta de situação (ex.: "Pronto", "Atrasado"). Sempre com texto, nunca só cor. */
export function Selo({ tom = 'neutro', children }: { tom?: TomSelo; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold ${TONS[tom]}`}>
      {children}
    </span>
  )
}
