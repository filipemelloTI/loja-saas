'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Campo } from '@/components/ui/Campo'
import { Selo } from '@/components/ui/Selo'
import { formatarDataISO, formatarTelefone } from '@/lib/formatar'
import { ROTULO_SITUACAO } from '@/lib/garantia'
import { filtrarGarantias, type ItemGarantia } from '@/lib/garantia-lista'

/** A busca filtra aqui na tela: nome, telefone ou IMEI nunca vão para a URL. */
export function ListaGarantias({ itens }: { itens: ItemGarantia[] }) {
  const [termo, setTermo] = useState('')
  const [soVencendo, setSoVencendo] = useState(false)
  const visiveis = filtrarGarantias(itens, termo, soVencendo)
  const vencendo = itens.filter((g) => g.situacao === 'vencendo').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo
          id="busca-garantia"
          name="busca"
          rotulo="Buscar por nome, telefone ou IMEI"
          type="search"
          autoComplete="off"
          className="min-w-0 flex-1 sm:max-w-sm"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <label className="flex min-h-11 items-center gap-2 text-tinta">
          <input
            type="checkbox"
            checked={soVencendo}
            onChange={(e) => setSoVencendo(e.target.checked)}
            className="size-5 accent-marca"
          />
          Só as que vencem em até 15 dias <span className="numeros text-tinta-suave">({vencendo})</span>
        </label>
      </div>

      {itens.length === 0 ? (
        <p className="text-tinta-suave">Nenhuma OS em garantia agora. Elas aparecem aqui depois da entrega.</p>
      ) : visiveis.length === 0 ? (
        <p className="text-tinta-suave">Nada encontrado com essa busca.</p>
      ) : (
        <ul className="realce flex flex-col divide-y divide-linha rounded-xl border border-linha bg-superficie">
          {visiveis.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <Link href={`/servico/${g.id}`} className="numeros font-semibold text-marca hover:underline">
                Nº {g.numero}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="break-words text-tinta">{g.cliente ?? 'Cliente'}</span>
                <span className="text-sm text-tinta-suave">
                  {g.aparelho}
                  {g.telefone && <> · <span className="numeros">{formatarTelefone(g.telefone)}</span></>}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Selo tom={g.situacao === 'vencendo' ? 'aviso' : 'info'}>{ROTULO_SITUACAO[g.situacao]}</Selo>
                <span className="numeros text-sm text-tinta-suave">
                  até {formatarDataISO(g.venceEm)}
                  {g.diasRestantes <= 15 && ` · ${g.diasRestantes === 0 ? 'hoje' : `${g.diasRestantes}d`}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
