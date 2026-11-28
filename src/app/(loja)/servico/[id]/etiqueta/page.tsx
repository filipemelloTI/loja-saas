import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AreaProtegida } from '@/components/AreaProtegida'
import { Roda } from '@/components/ui/Botao'
import { formatarData } from '@/lib/formatar'
import { contextoAtual } from '@/lib/sessao'
import { Documento } from '../../_componentes/documento'
import { carregarOS } from '../../dados'

export const metadata: Metadata = { title: 'Etiqueta' }

export default function PaginaEtiqueta({ params }: PageProps<'/servico/[id]/etiqueta'>) {
  return (
    <AreaProtegida area="servico">
      <Suspense
        fallback={
          <p role="status" className="flex items-center gap-2 text-tinta-suave">
            <Roda /> Carregando…
          </p>
        }
      >
        <Etiqueta params={params} />
      </Suspense>
    </AreaProtegida>
  )
}

/** Etiqueta de 50 × 30 mm para colar no aparelho: o número da OS precisa ser lido de longe. */
async function Etiqueta({ params }: { params: PageProps<'/servico/[id]/etiqueta'>['params'] }) {
  const { id } = await params
  const [{ os }, ctx] = await Promise.all([carregarOS(id), contextoAtual()])
  if (!os) notFound()
  const aparelho = [os.marca, os.modelo].filter(Boolean).join(' ') || 'Aparelho'
  const cliente = os.interna ? 'OS interna' : (os.clienteNome?.trim().split(/\s+/)[0] ?? '')

  return (
    <Documento
      voltar={{ href: `/servico/${id}`, rotulo: `OS Nº ${os.numero}` }}
      formato="etiqueta"
      papel="size: 50mm 30mm; margin: 0;"
      outros={[{ href: `/servico/${id}/comprovante`, rotulo: 'Comprovante' }]}
    >
      <div className="flex h-[26mm] flex-col justify-between overflow-hidden leading-tight">
        <p className="truncate text-[9px] text-folha-suave">{ctx?.loja?.nome}</p>
        <p className="font-titulo text-[22px] font-bold leading-none">
          OS <span className="numeros">{os.numero}</span>
        </p>
        <p className="truncate font-semibold">{cliente}</p>
        <p className="truncate">{aparelho}</p>
        <p className="numeros text-[9px] text-folha-suave">Entrada {formatarData(os.criadoEm)}</p>
      </div>
    </Documento>
  )
}
