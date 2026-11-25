import type { ReactNode } from 'react'

export type TomSelo = 'neutro' | 'info' | 'aviso' | 'perigo'

const TONS: Record<TomSelo, string> = {
  neutro: 'border-linha-forte bg-superficie-2 text-tinta-suave',
  info: 'border-marca bg-marca-suave text-marca-forte',
  aviso: 'border-sinal bg-sinal-suave text-sobre-sinal-suave',
  perigo: 'border-perigo bg-perigo-suave text-sobre-perigo-suave',
}

/**
 * Etiqueta curta de situação (ex.: "Pronto", "Atrasado"). Sempre com texto,
 * nunca só cor — quem não distingue cores precisa ler o estado.
 */
export function Selo({ tom = 'neutro', children }: { tom?: TomSelo; children: ReactNode }) {
  return (
    <span
      className={
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 ' +
        'font-mono text-xs font-medium uppercase tracking-wider ' +
        TONS[tom]
      }
    >
      {children}
    </span>
  )
}
