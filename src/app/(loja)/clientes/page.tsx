import type { Metadata } from 'next'
import { EmBreve } from '@/components/EmBreve'
import { AreaProtegida } from '@/components/AreaProtegida'

export const metadata: Metadata = { title: 'Clientes' }

export default function PaginaClientes() {
  return (
    <AreaProtegida area="clientes">
      <EmBreve titulo="Clientes" sobre="Cadastro de clientes, com os aparelhos e o histórico de cada um." />
    </AreaProtegida>
  )
}
