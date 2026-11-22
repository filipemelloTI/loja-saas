import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Cartao } from '@/components/ui/Cartao'
import { exigirAdminPlataforma } from '@/lib/sessao'
import { FormularioPlano } from '../componentes'
import { carregarPlanos } from '../dados'

export const metadata: Metadata = { title: 'Planos' }

export default function Planos() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-titulo text-3xl font-bold tracking-tight">Planos</h1>
        <p className="max-w-prose text-tinta-suave">
          Os módulos do plano vêm marcados ao criar a loja. O limite conta só usuários ativos.
        </p>
      </div>
      <Suspense fallback={<p className="text-tinta-suave">Carregando planos…</p>}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  await exigirAdminPlataforma()
  const planos = await carregarPlanos()
  return (
    <>
      {planos.map((p) => (
        <Cartao key={p.id} titulo={p.nome}>
          <FormularioPlano plano={p} />
        </Cartao>
      ))}
      <Cartao titulo="Novo plano">
        <FormularioPlano />
      </Cartao>
    </>
  )
}
