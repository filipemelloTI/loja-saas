import { Suspense } from 'react'
import { FormularioSenha } from './formulario'

async function Conteudo({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  return <FormularioSenha erro={erro} />
}

export default function DefinirSenha({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  return (
    <Suspense>
      <Conteudo searchParams={searchParams} />
    </Suspense>
  )
}
