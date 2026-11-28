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
import { Documento, lerFormato, type Formato } from '../../_componentes/documento'

export const metadata: Metadata = { title: 'Termo de garantia' }

export default function PaginaTermo({ params, searchParams }: PageProps<'/servico/[id]/termo'>) {
  return (
    <AreaProtegida area="servico">
      <Suspense
        fallback={
          <p role="status" className="flex items-center gap-2 text-tinta-suave">
            <Roda /> Carregando…
          </p>
        }
      >
        <Termo params={params} searchParams={searchParams} />
      </Suspense>
    </AreaProtegida>
  )
}

async function Termo({
  params,
  searchParams,
}: Pick<PageProps<'/servico/[id]/termo'>, 'params' | 'searchParams'>) {
  const [{ id }, busca] = await Promise.all([params, searchParams])
  const formato: Formato = lerFormato(busca.formato)
  const estreito = formato === '80mm'
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
  const linha = estreito ? 'flex flex-col gap-1' : 'grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 print:grid-cols-[8rem_1fr]'

  return (
    <Documento
      voltar={{ href: `/servico/${id}`, rotulo: `OS Nº ${os.numero}` }}
      formato={formato}
      papel={estreito ? 'size: 80mm auto; margin: 2mm;' : 'size: A4; margin: 12mm;'}
      outros={[
        estreito
          ? { href: `/servico/${id}/termo?formato=a4`, rotulo: 'Ver em A4' }
          : { href: `/servico/${id}/termo?formato=80mm`, rotulo: 'Ver em 80 mm' },
      ]}
    >
        <header className={`flex flex-col gap-1 border-b border-folha-linha pb-4 ${estreito ? 'items-center text-center' : ''}`}>
          <p className={`font-titulo font-bold ${estreito ? 'text-base' : 'text-2xl'}`}>{ctx?.loja?.nome}</p>
          <p className="text-sm text-folha-suave">
            {[termo.loja.cnpj && `CNPJ ${termo.loja.cnpj}`, termo.loja.endereco, termo.loja.telefone && formatarTelefone(termo.loja.telefone)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>

        <h1 className={`mt-6 font-titulo font-bold ${estreito ? 'text-base' : 'text-xl'}`}>
          Termo de garantia de serviço — OS <span className="numeros">Nº {os.numero}</span>
        </h1>

        <section className="mt-5 flex flex-col gap-4">
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

        <footer className={`mt-16 grid gap-10 text-center ${estreito ? '' : 'grid-cols-2'}`}>
          <div className="border-t border-sobre-folha pt-2">{ctx?.loja?.nome}</div>
          <div className="border-t border-sobre-folha pt-2">{termo.cliente?.nome ?? 'Cliente'}</div>
        </footer>
    </Documento>
  )
}
