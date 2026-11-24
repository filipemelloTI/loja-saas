import { AreaProtegida } from '@/components/AreaProtegida'

/** Todas as telas de Configurações são só do Dono (o admin em suporte vê como Dono, só leitura). */
export default function LayoutConfiguracoes({ children }: LayoutProps<'/configuracoes'>) {
  return <AreaProtegida area="configuracoes">{children}</AreaProtegida>
}
