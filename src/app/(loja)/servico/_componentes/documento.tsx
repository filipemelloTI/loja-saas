import type { ReactNode } from 'react'
import Link from 'next/link'
import { classesBotao } from '@/components/ui/Botao'
import { BotaoImprimir } from '../[id]/termo/imprimir'

export type Formato = 'a4' | '80mm'

export function lerFormato(valor: string | string[] | undefined): Formato {
  return (Array.isArray(valor) ? valor[0] : valor) === '80mm' ? '80mm' : 'a4'
}

/**
 * Moldura comum dos documentos impressos: barra de ações (some na impressão), tamanho de papel
 * (`@page`) e a folha clara nos dois temas. Em 80 mm a folha tem a largura da bobina.
 */
export function Documento({
  voltar,
  formato,
  outros,
  papel,
  children,
}: {
  voltar: { href: string; rotulo: string }
  formato: Formato | 'etiqueta'
  /** Links para os outros formatos do mesmo documento. */
  outros?: { href: string; rotulo: string }[]
  /** Regra `@page` (tamanho e margem do papel). */
  papel: string
  children: ReactNode
}) {
  const largura =
    formato === '80mm' ? 'max-w-[80mm] p-[3mm] text-[12px]' : formato === 'etiqueta' ? 'max-w-[50mm] p-[2mm] text-[11px]' : 'max-w-[210mm] p-6 sm:p-10 text-sm'
  return (
    <div className="flex flex-col gap-4">
      <style>{`@page { ${papel} }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={voltar.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-marca hover:underline">
          <span aria-hidden="true">←&nbsp;</span>
          {voltar.rotulo}
        </Link>
        <div className="flex flex-wrap gap-2">
          {outros?.map((o) => (
            <Link key={o.href} href={o.href} className={classesBotao('discreto')}>
              {o.rotulo}
            </Link>
          ))}
          <BotaoImprimir />
        </div>
      </div>
      <article
        className={`mx-auto w-full rounded-xl border border-linha bg-folha text-sobre-folha shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none ${largura}`}
      >
        {children}
      </article>
    </div>
  )
}
