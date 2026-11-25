import type { ButtonHTMLAttributes } from 'react'

export type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'discreto'

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-marca text-sobre-marca hover:bg-marca-forte',
  secundario: 'border border-linha-forte bg-superficie text-tinta hover:bg-superficie-2',
  perigo: 'border border-perigo bg-superficie text-perigo hover:bg-perigo-suave',
  discreto: 'text-tinta-suave hover:bg-superficie-2 hover:text-tinta',
}

/** Classes do botão, para usar também em links (`<Link className={classesBotao()}>`). */
export function classesBotao(variante: VarianteBotao = 'primario', extra = '') {
  return `${BASE} ${VARIANTES[variante]} ${extra}`.trim()
}

/**
 * Roda de carregando. Herda a cor de quem a contém (`currentColor`) e some com
 * "reduzir movimento" ligado — lá o texto é que avisa a espera.
 */
export function Roda({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`size-4 shrink-0 animate-spin motion-reduce:hidden ${className}`.trim()}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export type PropsBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao
  /** Mostra a roda, desabilita o botão e marca `aria-busy`. */
  carregando?: boolean
  /** Texto enquanto carrega (ex.: "Salvando…"). Sem ele, o rótulo normal fica. */
  rotuloCarregando?: string
}

export function Botao({
  variante = 'primario',
  className = '',
  type = 'button',
  carregando = false,
  rotuloCarregando,
  disabled,
  children,
  ...resto
}: PropsBotao) {
  return (
    <button
      type={type}
      className={classesBotao(variante, className)}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando && <Roda />}
      {carregando && rotuloCarregando ? rotuloCarregando : children}
    </button>
  )
}
