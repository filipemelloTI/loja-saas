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

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao }

export function Botao({ variante = 'primario', className = '', type = 'button', ...resto }: Props) {
  return <button type={type} className={classesBotao(variante, className)} {...resto} />
}
