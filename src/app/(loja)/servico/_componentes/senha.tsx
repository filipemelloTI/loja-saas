'use client'

import { useState, useTransition } from 'react'
import { Alerta } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { revelarSenha } from '../senha'

/**
 * Senha do aparelho. A página só monta este componente quando há uma senha que esta pessoa pode ver,
 * e o valor NÃO vem no HTML: é buscado ao tocar em "Mostrar senha" e some ao ocultar.
 */
export function SenhaDoAparelho({ osId }: { osId: string }) {
  const [senha, setSenha] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function mostrar() {
    setErro(null)
    iniciar(async () => {
      try {
        const s = await revelarSenha(osId)
        if (s === null) return setErro('A senha não está mais disponível. Recarregue a página.')
        setSenha(s)
      } catch {
        setErro('Não foi possível mostrar a senha agora. Tente de novo.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {senha === null ? (
        <div>
          <Botao variante="secundario" onClick={mostrar} carregando={pendente} rotuloCarregando="Buscando…">
            Mostrar senha
          </Botao>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="numeros min-w-0 break-all rounded-lg border border-linha-forte bg-superficie-2 px-3 py-2 text-xl text-tinta">
            {senha}
          </p>
          <Botao variante="discreto" onClick={() => setSenha(null)}>
            Ocultar senha
          </Botao>
        </div>
      )}
      {erro && <Alerta>{erro}</Alerta>}
    </div>
  )
}
