import type { Metadata } from 'next'
import { EmBreve } from '@/components/EmBreve'
import { AreaProtegida } from '@/components/AreaProtegida'

export const metadata: Metadata = { title: 'Serviço' }

export default function PaginaServico() {
  return (
    <AreaProtegida area="servico">
      <EmBreve titulo="Serviço" sobre="Ordens de serviço: o aparelho que entra, o conserto e a entrega ao cliente." />
    </AreaProtegida>
  )
}
