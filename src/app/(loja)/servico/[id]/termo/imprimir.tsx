'use client'

import { Botao } from '@/components/ui/Botao'

export function BotaoImprimir() {
  return (
    <Botao className="print:hidden" onClick={() => window.print()}>
      Imprimir ou salvar em PDF
    </Botao>
  )
}
