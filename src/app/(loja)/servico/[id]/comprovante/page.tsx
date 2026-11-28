import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AreaProtegida } from '@/components/AreaProtegida'
import { Roda } from '@/components/ui/Botao'
import { formatarDataHora, formatarDataISO, formatarTelefone } from '@/lib/formatar'
import { gerarQrSvg } from '@/lib/qr'
import { ROTULO_APARELHO } from '@/lib/rotulos'
import { contextoAtual } from '@/lib/sessao'
import { Documento, lerFormato, type Formato } from '../../_componentes/documento'
import { carregarOS, carregarTermo, linkAcompanhamento } from '../../dados'

export const metadata: Metadata = { title: 'Comprovante de entrada' }

type Props = PageProps<'/servico/[id]/comprovante'>

export default function PaginaComprovante({ params, searchParams }: Props) {
  return (
    <AreaProtegida area="servico">
      <Suspense
        fallback={
          <p role="status" className="flex items-center gap-2 text-tinta-suave">
            <Roda /> Carregando…
          </p>
        }
      >
        <Comprovante params={params} searchParams={searchParams} />
      </Suspense>
    </AreaProtegida>
  )
}

async function Comprovante({ params, searchParams }: Pick<Props, 'params' | 'searchParams'>) {
  const [{ id }, busca] = await Promise.all([params, searchParams])
  const formato: Formato = lerFormato(busca.formato)
  const [{ os }, ctx] = await Promise.all([carregarOS(id), contextoAtual()])
  if (!os) notFound()

  const [termo, link] = await Promise.all([carregarTermo(os.clienteId), os.interna ? null : linkAcompanhamento(os.tokenPublico)])
  const qr = link ? await gerarQrSvg(link) : null
  const estreito = formato === '80mm'
  const aparelho = [ROTULO_APARELHO[os.aparelhoTipo] ?? 'Aparelho', os.marca, os.modelo].filter(Boolean).join(' · ')
  const marcados = os.checklist.filter((c) => c.marcado || c.observacao)
  const linha = estreito ? 'flex flex-col' : 'grid grid-cols-[9rem_1fr] gap-x-3'

  const campos: [string, string | null][] = [
    ['Cliente', os.interna ? 'OS interna' : (termo.cliente?.nome ?? '—')],
    ['Telefone', termo.cliente?.telefone ? formatarTelefone(termo.cliente.telefone) : null],
    ['Aparelho', aparelho],
    ['Cor', os.cor],
    ['IMEI / série', os.imei],
    ['Acessórios', os.acessorios.length ? os.acessorios.join(', ') : 'Nenhum'],
    ['Previsão', os.previsaoEntrega ? formatarDataISO(os.previsaoEntrega) : null],
  ]

  return (
    <Documento
      voltar={{ href: `/servico/${id}`, rotulo: `OS Nº ${os.numero}` }}
      formato={formato}
      papel={estreito ? 'size: 80mm auto; margin: 2mm;' : 'size: A4; margin: 12mm;'}
      outros={[
        estreito
          ? { href: `/servico/${id}/comprovante?formato=a4`, rotulo: 'Ver em A4' }
          : { href: `/servico/${id}/comprovante?formato=80mm`, rotulo: 'Ver em 80 mm' },
        { href: `/servico/${id}/etiqueta`, rotulo: 'Etiqueta' },
      ]}
    >
      <header className={`flex flex-col gap-0.5 border-b border-folha-linha pb-3 ${estreito ? 'items-center text-center' : ''}`}>
        <p className={`font-titulo font-bold ${estreito ? 'text-base' : 'text-2xl'}`}>{ctx?.loja?.nome}</p>
        <p className="text-folha-suave">
          {[termo.loja.cnpj && `CNPJ ${termo.loja.cnpj}`, termo.loja.endereco, termo.loja.telefone && formatarTelefone(termo.loja.telefone)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <div className={`mt-3 flex flex-wrap items-baseline justify-between gap-2 ${estreito ? 'flex-col items-center' : ''}`}>
        <h1 className={`font-titulo font-bold ${estreito ? 'text-lg' : 'text-xl'}`}>
          Comprovante de entrada — OS <span className="numeros">Nº {os.numero}</span>
        </h1>
        <p className="numeros text-folha-suave">{formatarDataHora(os.criadoEm)}</p>
      </div>

      <dl className="mt-3 flex flex-col gap-1.5">
        {campos
          .filter(([, v]) => v)
          .map(([rotulo, valor]) => (
            <div key={rotulo} className={linha}>
              <dt className="font-semibold">{rotulo}</dt>
              <dd className="break-words">{valor}</dd>
            </div>
          ))}
      </dl>

      <div className="mt-3 flex flex-col gap-1">
        <p className="font-semibold">Defeito relatado</p>
        <p className="whitespace-pre-wrap">{os.defeitoRelatado}</p>
      </div>

      {marcados.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          <p className="font-semibold">Estado do aparelho na entrada</p>
          <ul className="list-disc pl-5">
            {marcados.map((c) => (
              <li key={c.nome}>
                {c.nome}
                {c.observacao && ` — ${c.observacao}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {qr && link && (
        <div className={`mt-4 flex items-center gap-3 border-t border-folha-linha pt-3 ${estreito ? 'flex-col text-center' : ''}`}>
          <div
            aria-label="QR code do link de acompanhamento"
            role="img"
            className={estreito ? 'size-28' : 'size-24 shrink-0'}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold">Acompanhe o conserto pelo celular</p>
            <p className="text-folha-suave">Aponte a câmera para o código ou abra o endereço:</p>
            <p className="break-all font-mono text-[10px]">{link}</p>
          </div>
        </div>
      )}

      {termo.loja.textoTermos && (
        <p className="mt-4 whitespace-pre-wrap border-t border-folha-linha pt-3 text-folha-suave">{termo.loja.textoTermos}</p>
      )}

      <div className={`mt-10 grid gap-8 text-center ${estreito ? '' : 'grid-cols-2'}`}>
        <div className="border-t border-sobre-folha pt-1">{ctx?.loja?.nome}</div>
        <div className="border-t border-sobre-folha pt-1">{os.interna ? 'Responsável' : (termo.cliente?.nome ?? 'Cliente')}</div>
      </div>
    </Documento>
  )
}
