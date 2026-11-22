import { Suspense, type ReactNode } from 'react'
import { exigirArea } from '@/lib/sessao'
import type { Area } from '@/lib/tipos'

/**
 * Só mostra o conteúdo se o perfil e os módulos da loja liberam a área; senão volta
 * para o Início. Fica atrás do próprio <Suspense> porque, com Cache Components, a
 * página é renderizada sozinha ao navegar (o layout não roda de novo).
 */
export function AreaProtegida({ area, children }: { area: Area; children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Guarda area={area}>{children}</Guarda>
    </Suspense>
  )
}

async function Guarda({ area, children }: { area: Area; children: ReactNode }) {
  await exigirArea(area)
  return children
}
