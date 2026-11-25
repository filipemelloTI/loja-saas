import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AreaProtegida } from '@/components/AreaProtegida'
import { classesBotao, Roda } from '@/components/ui/Botao'
import Link from 'next/link'
import { ROTULO_STATUS, type StatusOS } from '@/lib/os-status'
import { ListaOS } from './_componentes/lista'
import { listarOS } from './dados'

export const metadata: Metadata = { title: 'Serviço' }

type Busca = Promise<{ estado?: string | string[] }>

export default function PaginaServico({ searchParams }: { searchParams: Busca }) {
  return (
    <AreaProtegida area="servico">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="font-titulo text-3xl font-bold tracking-tight">Serviço</h1>
            <p className="max-w-prose text-tinta-suave">
              Os aparelhos que estão na loja. Escolha uma etapa para filtrar e toque no número para abrir a ordem de serviço.
            </p>
          </div>
        </div>
        <Suspense
          fallback={
            <p role="status" className="flex items-center gap-2 text-tinta-suave">
              <Roda /> Carregando…
            </p>
          }
        >
          <Conteudo searchParams={searchParams} />
        </Suspense>
      </div>
    </AreaProtegida>
  )
}

async function Conteudo({ searchParams }: { searchParams: Busca }) {
  const { estado } = await searchParams
  const bruto = Array.isArray(estado) ? estado[0] : estado
  // Valor desconhecido na URL vale como "todas": nunca vira filtro no banco.
  const filtro = bruto && Object.hasOwn(ROTULO_STATUS, bruto) ? (bruto as StatusOS) : undefined
  const { ordens, somenteLeitura } = await listarOS(filtro)
  return (
    <>
      {!somenteLeitura && (
        <div>
          <Link href="/servico/nova" className={classesBotao('primario')}>
            Nova OS
          </Link>
        </div>
      )}
      <ListaOS ordens={ordens} filtro={filtro} somenteLeitura={somenteLeitura} />
    </>
  )
}
