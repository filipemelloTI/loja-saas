import type { Metadata } from 'next'
import { EmBreve } from '@/components/EmBreve'
import { AreaProtegida } from '@/components/AreaProtegida'

export const metadata: Metadata = { title: 'Configurações' }

export default function PaginaConfiguracoes() {
  return (
    <AreaProtegida area="configuracoes">
      <EmBreve titulo="Configurações" sobre="Dados da loja, usuários, serviços e mensagens." />
    </AreaProtegida>
  )
}
