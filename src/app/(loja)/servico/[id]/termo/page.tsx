import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AreaProtegida } from '@/components/AreaProtegida'
import { Roda } from '@/components/ui/Botao'
import { formatarData, formatarDataISO, formatarTelefone } from '@/lib/formatar'
import { situacaoGarantia } from '@/lib/garantia'
import { ROTULO_APARELHO } from '@/lib/rotulos'
import { contextoAtual } from '@/lib/sessao'
import { carregarOrcamento, carregarOS, carregarTermo } from '../../dados'
import { BotaoImprimir } from './imprimir'

export const metadata: Metadata = { title: 'Termo de garantia' }

export default function PaginaTermo({ params }: PageProps<'/servico/[id]/termo'>) {
  return (
    <AreaProtegida area="servico">
      <Suspense
        fallback={
          <p role="status" className="flex items-center gap-2 text-tinta-suave">
            <Roda /> Carregando…
          </p>
        }
      >
        <Termo params={params} />
      </Suspense>
    </AreaProtegida>
  )
}

async function Termo({ params }: { params: PageProps<'/servico/[id]/termo'>['params'] }) {
  const { id } = await params
  const [{ os }, orcamento, ctx] = await Promise.all([carregarOS(id), carregarOrcamento(id), contextoAtual()])
  if (!os) notFound()
  if (os.status !== 'entregue' || os.garantiaDias === null || !os.encerradaEm) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-tinta-suave">O termo de garantia fica disponível depois da entrega de uma OS com garantia.</p>
        <Link href={`/servico/${id}`} className="text-sm font-semibold text-marca hover:underline">
          ← Voltar para a OS
        </Link>
      </div>
    )
  }

  const termo = await carregarTermo(os.clienteId)
  const g = situacaoGarantia(os.encerradaEm, os.garantiaDias)
  const servicos = [
    ...(orcamento.atual?.status === 'aprovado' ? orcamento.atual.itens.map((i) => i.descricao) : []),
    ...orcamento.pecas.map((p) => `Peça: ${p.descricao}`),
  ]
  const aparelho = [ROTULO_APARELHO[os.aparelhoTipo] ?? 'Aparelho', os.marca, os.modelo, os.cor].filter(Boolean).join(' · ')
  const linha = 'grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 print:grid-cols-[8rem_1fr]'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/servico/${id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-marca hover:underline">
          <span aria-hidden="true">←&nbsp;</span>OS Nº {os.numero}
        </Link>
        <BotaoImprimir />
      </div>

      {/* Folha A4: fundo e tinta fixos de papel, também no tema escuro. */}
      <article className="mx-auto w-full max-w-[210mm] rounded-xl border border-linha bg-folha p-6 text-sobre-folha shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col gap-1 border-b border-folha-linha pb-4">
          <p className="font-titulo text-2xl font-bold">{ctx?.loja?.nome}</p>
          <p className="text-sm text-folha-suave">
            {[termo.loja.cnpj && `CNPJ ${termo.loja.cnpj}`, termo.loja.endereco, termo.loja.telefone && formatarTelefone(termo.loja.telefone)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>

        <h1 className="mt-6 font-titulo text-xl font-bold">
          Termo de garantia de serviço — OS <span className="numeros">Nº {os.numero}</span>
        </h1>

        <section className="mt-5 flex flex-col gap-4 text-sm">
          <dl className={linha}>
            <dt className="font-semibold">Cliente</dt>
            <dd>
              {termo.cliente?.nome ?? '—'}
              {termo.cliente?.telefone && ` · ${formatarTelefone(termo.cliente.telefone)}`}
            </dd>
            <dt className="font-semibold">Aparelho</dt>
            <dd>{aparelho}</dd>
            <dt className="font-semibold">IMEI / série</dt>
            <dd className="numeros">{os.imei ?? '—'}</dd>
            <dt className="font-semibold">Serviço</dt>
            <dd>{servicos.length ? servicos.join('; ') : os.defeitoRelatado}</dd>
            <dt className="font-semibold">Entregue em</dt>
            <dd className="numeros">{formatarData(os.encerradaEm)}</dd>
            <dt className="font-semibold">Garantia</dt>
            <dd>
              <span className="numeros">{os.garantiaDias}</span> dias, até{' '}
              <span className="numeros font-semibold">{formatarDataISO(g.venceEm)}</span>
            </dd>
          </dl>

          <div className="flex flex-col gap-1">
            <p className="font-semibold">A garantia cobre o serviço realizado e as peças trocadas. Ela não vale em caso de:</p>
            <ul className="list-disc pl-5">
              {termo.condicoes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          {termo.loja.textoTermos && <p className="whitespace-pre-wrap">{termo.loja.textoTermos}</p>}
        </section>

        <footer className="mt-16 grid gap-10 text-center text-sm sm:grid-cols-2 print:grid-cols-2">
          <div className="border-t border-sobre-folha pt-2">{ctx?.loja?.nome}</div>
          <div className="border-t border-sobre-folha pt-2">{termo.cliente?.nome ?? 'Cliente'}</div>
        </footer>
      </article>
    </div>
  )
}
