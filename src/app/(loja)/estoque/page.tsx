import type { Metadata } from 'next'
import { EmBreve } from '@/components/EmBreve'
import { AreaProtegida } from '@/components/AreaProtegida'

export const metadata: Metadata = { title: 'Estoque' }

export default function PaginaEstoque() {
  return (
    <AreaProtegida area="estoque">
      <EmBreve titulo="Estoque" sobre="Aparelhos, peças e acessórios, com aviso quando algo estiver acabando." />
    </AreaProtegida>
  )
}
