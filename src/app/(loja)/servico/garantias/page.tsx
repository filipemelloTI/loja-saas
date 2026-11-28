import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AreaProtegida } from '@/components/AreaProtegida'
import { Roda } from '@/components/ui/Botao'
import { listarGarantias } from '../dados'
import { ListaGarantias } from './lista'

export const metadata: Metadata = { title: 'Garantias' }

export default function PaginaGarantias() {
  return (
    <AreaProtegida area="servico">
      <div className="flex flex-col gap-6">
        <Link href="/servico" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-marca hover:underline">
          <span aria-hidden="true">←&nbsp;</span>Serviço
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="font-titulo text-3xl font-bold tracking-tight">Garantias</h1>
          <p className="max-w-prose text-tinta-suave">
            Aparelhos entregues que ainda estão na garantia, os que vencem antes primeiro. Quando o cliente voltar com o
            mesmo problema, abra a OS e use “O aparelho voltou com o mesmo problema”.
          </p>
        </div>
        <Suspense
          fallback={
            <p role="status" className="flex items-center gap-2 text-tinta-suave">
              <Roda /> Carregando…
            </p>
          }
        >
          <Conteudo />
        </Suspense>
      </div>
    </AreaProtegida>
  )
}

async function Conteudo() {
  return <ListaGarantias itens={await listarGarantias()} />
}
