import { Suspense } from 'react'
import type { Metadata } from 'next'
import { AreaProtegida } from '@/components/AreaProtegida'
import { Roda } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { FormularioCliente } from './_componentes/formulario'
import { ListaClientes } from './_componentes/lista'
import { listarClientes } from './dados'
import { resumir } from './resumo'

export const metadata: Metadata = { title: 'Clientes' }

export default function PaginaClientes() {
  return (
    <AreaProtegida area="clientes">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-titulo text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="max-w-prose text-tinta-suave">
            Busque pelo nome, telefone, CPF ou IMEI do aparelho. Toque no nome para ver a ficha e as ordens de serviço.
          </p>
        </div>
        <Suspense
          fallback={
            <p role="status" className="flex items-center gap-2 text-tinta-suave">
              <Roda /> Carregando…
            </p>
          }
        >
          <Conteudo />
        </Suspense>
      </div>
    </AreaProtegida>
  )
}

async function Conteudo() {
  const { clientes, somenteLeitura } = await listarClientes('')
  // A lista não leva o CPF: só o que o balcão precisa para achar a pessoa.
  return (
    <>
      <ListaClientes clientes={clientes.map(resumir)} somenteLeitura={somenteLeitura} />
      <Cartao titulo="Novo cliente">
        <FormularioCliente somenteLeitura={somenteLeitura} />
      </Cartao>
    </>
  )
}
