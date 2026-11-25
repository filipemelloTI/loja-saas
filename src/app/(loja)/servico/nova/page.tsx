import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AreaProtegida } from '@/components/AreaProtegida'
import { Roda } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { contextoAtual } from '@/lib/sessao'
import { listarChecklistDaLoja, listarTecnicos } from '../dados'
import { FormularioOS } from '../_componentes/formulario'

export const metadata: Metadata = { title: 'Nova OS' }

export default function PaginaNovaOS() {
  return (
    <AreaProtegida area="servico">
      <div className="flex flex-col gap-6">
        <Link href="/servico" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-marca hover:underline">
          <span aria-hidden="true">←&nbsp;</span>Serviço
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="font-titulo text-3xl font-bold tracking-tight">Nova OS</h1>
          <p className="max-w-prose text-tinta-suave">
            Registre o aparelho que chegou ao balcão. Só o tipo e o defeito são obrigatórios, e o cliente, a menos que seja uma OS interna.
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
  const [itensChecklist, tecnicos, ctx] = await Promise.all([listarChecklistDaLoja(), listarTecnicos(), contextoAtual()])
  const somenteLeitura = ctx?.emSuporte ?? true
  return (
    <Cartao>
      {somenteLeitura && (
        <p className="mb-4 rounded-lg bg-sinal-suave px-3 py-2 text-sobre-sinal-suave">
          Você está em modo suporte: dá para ver o formulário, mas não abrir OS.
        </p>
      )}
      <FormularioOS itensChecklist={itensChecklist} tecnicos={tecnicos} somenteLeitura={somenteLeitura} />
    </Cartao>
  )
}
