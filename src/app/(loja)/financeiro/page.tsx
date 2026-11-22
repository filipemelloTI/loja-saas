import type { Metadata } from 'next'
import { EmBreve } from '@/components/EmBreve'
import { AreaProtegida } from '@/components/AreaProtegida'

export const metadata: Metadata = { title: 'Financeiro' }

export default function PaginaFinanceiro() {
  return (
    <AreaProtegida area="financeiro">
      <EmBreve titulo="Financeiro" sobre="Caixa do dia, contas a pagar e a receber e comissão dos técnicos." />
    </AreaProtegida>
  )
}
