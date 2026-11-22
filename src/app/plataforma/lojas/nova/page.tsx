import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { exigirAdminPlataforma } from '@/lib/sessao'
import { FormularioNovaLoja } from '../../componentes'
import { carregarPlanos } from '../../dados'

export const metadata: Metadata = { title: 'Nova loja' }

export default function NovaLoja() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/plataforma" className="text-sm font-semibold text-marca hover:underline">
          ← Lojas
        </Link>
        <h1 className="font-titulo text-3xl font-bold tracking-tight">Nova loja</h1>
      </div>
      <Suspense fallback={<p className="text-tinta-suave">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  await exigirAdminPlataforma()
  const planos = await carregarPlanos()
  if (planos.length === 0) {
    return (
      <p className="text-tinta-suave">
        Crie um plano antes de criar a loja.{' '}
        <Link href="/plataforma/planos" className="font-semibold text-marca hover:underline">
          Ir para Planos
        </Link>
      </p>
    )
  }
  return <FormularioNovaLoja planos={planos} />
}
