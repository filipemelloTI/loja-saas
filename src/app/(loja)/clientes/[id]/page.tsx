import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AreaProtegida } from '@/components/AreaProtegida'
import { Roda } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { Selo } from '@/components/ui/Selo'
import { TabelaResponsiva } from '@/components/ui/TabelaResponsiva'
import { formatarCpf, formatarData, formatarDataISO, formatarTelefone } from '@/lib/formatar'
import { ROTULO_STATUS, type StatusOS } from '@/lib/os-status'
import { ROTULO_APARELHO } from '@/lib/rotulos'
import { contextoAtual } from '@/lib/sessao'
import { FormularioCliente } from '../_componentes/formulario'
import { carregarCliente, carregarHistoricoDoCliente } from '../dados'

export const metadata: Metadata = { title: 'Cliente' }

export default function PaginaCliente({ params }: PageProps<'/clientes/[id]'>) {
  return (
    <AreaProtegida area="clientes">
      <div className="flex flex-col gap-6">
        <Link href="/clientes" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-marca hover:underline">
          <span aria-hidden="true">←&nbsp;</span>Clientes
        </Link>
        <Suspense
          fallback={
            <p role="status" className="flex items-center gap-2 text-tinta-suave">
              <Roda /> Carregando…
            </p>
          }
        >
          <Conteudo params={params} />
        </Suspense>
      </div>
    </AreaProtegida>
  )
}

async function Conteudo({ params }: { params: PageProps<'/clientes/[id]'>['params'] }) {
  const { id } = await params
  const [cliente, historico, ctx] = await Promise.all([carregarCliente(id), carregarHistoricoDoCliente(id), contextoAtual()])
  if (!cliente) notFound()

  const dados: [string, string][] = [
    ['Telefone', formatarTelefone(cliente.telefone)],
    ['CPF', cliente.cpf ? formatarCpf(cliente.cpf) : '—'],
    ['E-mail', cliente.email ?? '—'],
    ['Endereço', cliente.endereco ?? '—'],
    ['Nascimento', cliente.nascimento ? formatarDataISO(cliente.nascimento) : '—'],
  ]

  return (
    <>
      <h1 className="font-titulo text-3xl font-bold tracking-tight">{cliente.nome}</h1>

      <Cartao etiqueta="Ficha" titulo="Dados do cliente">
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
          {dados.map(([rotulo, valor]) => (
            <div key={rotulo} className="contents">
              <dt className="sobrancelha">{rotulo}</dt>
              <dd className="numeros min-w-0 break-words text-tinta">{valor}</dd>
            </div>
          ))}
        </dl>
      </Cartao>

      <section aria-labelledby="historico" className="flex flex-col gap-3">
        <h2 id="historico" className="font-titulo text-lg font-semibold text-tinta">
          Ordens de serviço
        </h2>
        <TabelaResponsiva
          legenda={`Ordens de serviço de ${cliente.nome}`}
          linhas={historico}
          chave={(o) => o.id}
          vazio="Este cliente ainda não tem ordem de serviço. Quando você abrir uma para ele, ela aparece aqui."
          colunas={[
            { titulo: 'OS', valor: (o) => <span className="numeros">Nº {o.numero}</span> },
            {
              titulo: 'Aparelho',
              valor: (o) => [ROTULO_APARELHO[o.aparelhoTipo] ?? 'Aparelho', o.marca, o.modelo].filter(Boolean).join(' · '),
            },
            { titulo: 'IMEI', valor: (o) => <span className="numeros">{o.imei ?? '—'}</span> },
            {
              titulo: 'Situação',
              valor: (o) => {
                const s = ROTULO_STATUS[o.status as StatusOS]
                return <Selo tom={s?.tom}>{s?.rotulo ?? 'Em andamento'}</Selo>
              },
            },
            { titulo: 'Aberta em', valor: (o) => <span className="numeros">{formatarData(o.criadoEm)}</span> },
          ]}
        />
      </section>

      <Cartao titulo="Editar dados">
        <FormularioCliente cliente={cliente} somenteLeitura={ctx?.emSuporte ?? true} />
      </Cartao>
    </>
  )
}
