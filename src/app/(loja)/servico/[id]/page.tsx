import { Suspense, type ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AreaProtegida } from '@/components/AreaProtegida'
import { Roda } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { Selo } from '@/components/ui/Selo'
import { formatarData, formatarDataHora, formatarDataISO } from '@/lib/formatar'
import { perfilEfetivo } from '@/lib/guarda'
import { avancosDe, ehTerminal, podeMudar, ROTULO_STATUS, type StatusOS } from '@/lib/os-status'
import { ROTULO_APARELHO } from '@/lib/rotulos'
import { contextoAtual } from '@/lib/sessao'
import { FormularioLaudo } from '../_componentes/formulario'
import { SenhaDoAparelho } from '../_componentes/senha'
import { AcoesStatus } from '../_componentes/status'
import { carregarOS, nomeDoTecnicoDaOS } from '../dados'

export const metadata: Metadata = { title: 'Ordem de serviço' }

export default function PaginaOS({ params }: PageProps<'/servico/[id]'>) {
  return (
    <AreaProtegida area="servico">
      <div className="flex flex-col gap-6">
        <Link href="/servico" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-marca hover:underline">
          <span aria-hidden="true">←&nbsp;</span>Serviço
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

async function Conteudo({ params }: { params: PageProps<'/servico/[id]'>['params'] }) {
  const { id } = await params
  const [{ os, somenteLeitura }, ctx] = await Promise.all([carregarOS(id), contextoAtual()])
  if (!os) notFound()

  const perfil = ctx ? perfilEfetivo(ctx) : null
  const status = ROTULO_STATUS[os.status]
  const terminal = ehTerminal(os.status)
  const avancos = avancosDe(os.status)
  // Voltar etapa não é avanço: sai do que `podeMudar` libera para este perfil (hoje, só o Dono).
  const voltas = (Object.keys(ROTULO_STATUS) as StatusOS[]).filter(
    (s) => s !== os.status && !avancos.includes(s) && perfil !== null && podeMudar(os.status, s, perfil).ok,
  )
  // Lido direto pelo id: quem já saiu da equipe continua no registro da OS.
  const tecnico = await nomeDoTecnicoDaOS(os.tecnicoId)
  // O valor da senha nunca entra aqui: só se existe uma que esta pessoa pode ver. Ela é buscada ao tocar no botão.
  const haSenhaParaMostrar = !!os.senhaAparelho && !somenteLeitura

  const aparelho = [ROTULO_APARELHO[os.aparelhoTipo] ?? 'Aparelho', os.marca, os.modelo].filter(Boolean).join(' · ')
  const dados: [string, ReactNode][] = [
    ['Cliente', os.clienteId && os.clienteNome ? (
      <Link key="c" href={`/clientes/${os.clienteId}`} className="text-marca hover:underline">
        {os.clienteNome}
      </Link>
    ) : os.interna ? 'OS interna' : '—'],
    ['Aparelho', aparelho],
    ['Cor', os.cor ?? '—'],
    ['IMEI', <span key="i" className="numeros">{os.imei ?? '—'}</span>],
    ['Acessórios', os.acessorios.length ? os.acessorios.join(', ') : 'Nenhum'],
    ['Técnico', tecnico ?? 'Não definido'],
    ['Previsão', <span key="p" className="numeros">{os.previsaoEntrega ? formatarDataISO(os.previsaoEntrega) : '—'}</span>],
    ['Aberta em', <span key="a" className="numeros">{formatarData(os.criadoEm)}</span>],
    ...(os.encerradaEm ? ([['Encerrada em', <span key="e" className="numeros">{formatarData(os.encerradaEm)}</span>]] as [string, ReactNode][]) : []),
  ]

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-titulo text-3xl font-bold tracking-tight">
          OS <span className="numeros">Nº {os.numero}</span>
        </h1>
        <Selo tom={status.tom}>{status.rotulo}</Selo>
      </div>

      <Cartao etiqueta="Ficha" titulo="Aparelho e cliente">
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
          {dados.map(([rotulo, valor]) => (
            <div key={rotulo} className="contents">
              <dt className="sobrancelha">{rotulo}</dt>
              <dd className="min-w-0 break-words text-tinta">{valor}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-col gap-3 border-t border-linha pt-4">
          <div className="flex flex-col gap-1">
            <p className="sobrancelha">Defeito relatado</p>
            <p className="whitespace-pre-wrap text-tinta">{os.defeitoRelatado}</p>
          </div>
          {os.observacao && (
            <div className="flex flex-col gap-1">
              <p className="sobrancelha">Observação</p>
              <p className="whitespace-pre-wrap text-tinta">{os.observacao}</p>
            </div>
          )}
        </div>
      </Cartao>

      {os.checklist.length > 0 && (
        <Cartao etiqueta="Na entrada" titulo="Estado do aparelho">
          <ul className="flex flex-col gap-2">
            {os.checklist.map((c) => (
              <li key={c.nome} className="flex flex-wrap items-baseline gap-x-3">
                <span className={c.marcado ? 'font-semibold text-tinta' : 'text-tinta-suave'}>{c.nome}</span>
                <Selo tom={c.marcado ? 'aviso' : 'neutro'}>{c.marcado ? 'Marcado' : 'Não marcado'}</Selo>
                {c.observacao && <span className="text-sm text-tinta-suave">{c.observacao}</span>}
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao etiqueta="Etapa" titulo={terminal ? 'OS encerrada' : 'Mudar a etapa'}>
        {terminal ? (
          <p className="text-tinta-suave">
            Esta OS foi {os.status === 'devolvido' ? 'devolvida' : 'entregue'} e não muda mais de etapa. O histórico abaixo fica guardado.
          </p>
        ) : (
          <AcoesStatus osId={os.id} avancos={avancos} voltas={somenteLeitura ? [] : voltas} somenteLeitura={somenteLeitura} />
        )}
      </Cartao>

      <Cartao titulo="Laudo">
        <FormularioLaudo osId={os.id} laudo={os.laudo} somenteLeitura={somenteLeitura} encerrada={terminal} />
      </Cartao>

      {haSenhaParaMostrar && (
        <Cartao etiqueta="Só você vê" titulo="Senha do aparelho" className="print:hidden">
          <SenhaDoAparelho osId={os.id} />
        </Cartao>
      )}

      <section aria-labelledby="historico" className="flex flex-col gap-3">
        <h2 id="historico" className="font-titulo text-lg font-semibold text-tinta">
          Histórico
        </h2>
        <ol className="flex flex-col border-l-2 border-linha-forte">
          {os.historico.map((h, i) => (
            <li key={i} className="relative flex flex-col gap-1 pb-5 pl-5 last:pb-0">
              <span aria-hidden="true" className="absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-superficie bg-marca" />
              <div className="flex flex-wrap items-center gap-2">
                <Selo tom={ROTULO_STATUS[h.paraStatus]?.tom}>{ROTULO_STATUS[h.paraStatus]?.rotulo ?? 'Em andamento'}</Selo>
                {h.deStatus && (
                  <span className="text-sm text-tinta-suave">
                    depois de {ROTULO_STATUS[h.deStatus]?.rotulo ?? 'etapa anterior'}
                  </span>
                )}
              </div>
              <p className="text-sm text-tinta-suave">
                <span className="numeros">{formatarDataHora(h.criadoEm)}</span> · {h.membroNome}
              </p>
              {h.observacao && <p className="whitespace-pre-wrap text-tinta">{h.observacao}</p>}
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
