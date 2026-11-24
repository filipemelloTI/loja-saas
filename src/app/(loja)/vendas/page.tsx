import type { Metadata } from 'next'
import { EmBreve } from '@/components/EmBreve'
import { AreaProtegida } from '@/components/AreaProtegida'

export const metadata: Metadata = { title: 'Vendas' }

export default function PaginaVendas() {
  return (
    <AreaProtegida area="vendas">
      <EmBreve titulo="Vendas" sobre="Vendas no balcão, com aparelho na troca e recibo para o cliente." />
    </AreaProtegida>
  )
}
