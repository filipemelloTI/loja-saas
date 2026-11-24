import type { Metadata } from 'next'
import { EmBreve } from '@/components/EmBreve'
import { AreaProtegida } from '@/components/AreaProtegida'

export const metadata: Metadata = { title: 'Fornecedores' }

export default function PaginaFornecedores() {
  return (
    <AreaProtegida area="fornecedores">
      <EmBreve titulo="Fornecedores" sobre="Listas de preço dos fornecedores organizadas em um ranking, para comprar no melhor preço." />
    </AreaProtegida>
  )
}
