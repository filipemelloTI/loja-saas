'use client'

import { useId, useState } from 'react'
import { Botao } from '@/components/ui/Botao'

/** Link de definir senha com botão Copiar, para mandar pelo WhatsApp a `para` (ex.: "o Dono"). */
export function CaixaLink({ link, para }: { link: string; para: string }) {
  const id = useId()
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
    } catch {
      document.getElementById(id)?.focus()
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-tinta">
        Link para definir senha
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 w-full min-w-0 rounded-lg border border-linha-forte bg-superficie-2 px-3 text-sm text-tinta"
        />
        <Botao onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</Botao>
      </div>
      <p aria-live="polite" className="text-sm text-tinta-suave">
        {copiado
          ? `Link copiado. Cole na conversa com ${para} no WhatsApp.`
          : `Mande este link para ${para} pelo WhatsApp. Ele vale por 1 hora e só funciona uma vez.`}
      </p>
    </div>
  )
}
