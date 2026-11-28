import { Suspense, type ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AreaProtegida } from '@/components/AreaProtegida'
import { Roda } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { Selo } from '@/components/ui/Selo'
import { formatarReais } from '@/lib/dinheiro'
import { formatarData, formatarDataHora, formatarDataISO } from '@/lib/formatar'
import { perfilEfetivo } from '@/lib/guarda'
import { avancosDe, ehTerminal, podeMudar, ROTULO_STATUS, type StatusOS } from '@/lib/os-status'
import { ROTULO_APARELHO } from '@/lib/rotulos'
import { eventoDaEtapa } from '@/lib/whatsapp'
import { contextoAtual } from '@/lib/sessao'
import { FormularioLaudo } from '../_componentes/formulario'
import { OrcamentoDaOS } from '../_componentes/orcamento'
import { AvisarCliente } from '../_componentes/avisar'
import { EntregarOS } from '../_componentes/entregar'
import { PagamentoDaOS } from '../_componentes/pagamento'
import { PecasDaOS } from '../_componentes/pecas'
import { SenhaDoAparelho } from '../_componentes/senha'
import { AcoesStatus } from '../_componentes/status'
import {
  carregarAviso,
  carregarFechamento,
  carregarOrcamento,
  carregarOS,
  carregarPagamento,
  carregarPecas,
  listarServicosDaLoja,
  nomeDoTecnicoDaOS,
} from '../dados'

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
  const [{ os, somenteLeitura }, ctx, orcamento, servicos, pecas, pagamento, fechamento] = await Promise.all([
    carregarOS(id),
    contextoAtual(),
    carregarOrcamento(id),
    listarServicosDaLoja(),
    carregarPecas(id),
    carregarPagamento(id),
    carregarFechamento(id),
  ])
  if (!os) notFound()
  const aviso = !os.interna && os.clienteId && !somenteLeitura ? await carregarAviso(os.clienteId, os.tokenPublico) : null

  const perfil = ctx ? perfilEfetivo(ctx) : null
  const status = ROTULO_STATUS[os.status]
  const terminal = ehTerminal(os.status)
  // "Entregue" só pelo botão Entregar (congela os números). Na OS de cliente, enviar, aprovar e
  // recusar saem do bloco Orçamento, que registra quem aprovou e trava os itens.
  const peloOrcamento: StatusOS[] = os.interna ? [] : ['orcamento_enviado', 'aprovado', 'recusado']
  const avancos = avancosDe(os.status).filter((s) => s !== 'entregue' && !peloOrcamento.includes(s))
  const dicaEtapa =
    os.status === 'pronto'
      ? 'Para encerrar, use “Entregar aparelho” no bloco Entrega.'
      : !os.interna && (os.status === 'em_analise' || os.status === 'aberta')
        ? 'Com o orçamento pronto, marque como enviado ou registre a aprovação no bloco Orçamento.'
        : os.status === 'orcamento_enviado'
          ? 'Aguardando a resposta do cliente: registre no bloco Orçamento.'
          : undefined
  const pago = pagamento.pagamentos.reduce((t, p) => t + Math.round(p.valor * 100), 0)
  const falta = Math.max(Math.round(pagamento.total * 100) - pago, 0) / 100
  // Voltar etapa não é avanço: sai do que `podeMudar` libera para este perfil (hoje, só o Dono).
  const voltas = (Object.keys(ROTULO_STATUS) as StatusOS[]).filter(
    (s) => s !== os.status && !avancosDe(os.status).includes(s) && perfil !== null && podeMudar(os.status, s, perfil).ok,
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

      {(!os.interna || orcamento.atual) && (
        <Cartao etiqueta="Para o cliente" titulo="Orçamento">
          <OrcamentoDaOS
            key={orcamento.atual?.id ?? 'novo'}
            osId={os.id}
            dados={orcamento}
            servicos={servicos}
            bloqueado={somenteLeitura || terminal}
          />
        </Cartao>
      )}

      <Cartao etiqueta="Usadas no conserto" titulo="Peças">
        <PecasDaOS
          osId={os.id}
          dados={pecas}
          podeVerCusto={pecas.podeVerCusto}
          travadas={orcamento.atual?.status === 'enviado' || orcamento.atual?.status === 'aprovado'}
          bloqueado={somenteLeitura || terminal}
        />
      </Cartao>

      {(!os.interna || pagamento.pagamentos.length > 0) && (
        <Cartao etiqueta="Do cliente" titulo="Pagamento">
          <PagamentoDaOS
            key={os.status}
            osId={os.id}
            dados={pagamento}
            pronta={os.status === 'pronto'}
            bloqueado={somenteLeitura || terminal}
          />
        </Cartao>
      )}

      <Cartao etiqueta="Etapa" titulo={terminal ? 'OS encerrada' : 'Mudar a etapa'}>
        {terminal ? (
          <p className="text-tinta-suave">
            Esta OS foi {os.status === 'devolvido' ? 'devolvida' : 'entregue'} e não muda mais de etapa. O histórico abaixo fica guardado.
          </p>
        ) : (
          <AcoesStatus
            osId={os.id}
            avancos={avancos}
            voltas={somenteLeitura ? [] : voltas}
            somenteLeitura={somenteLeitura}
            dica={dicaEtapa}
          />
        )}
      </Cartao>

      {aviso && (
        <Cartao etiqueta="WhatsApp da loja" titulo="Avisar cliente">
          <AvisarCliente
            key={os.status}
            telefone={aviso.telefone}
            mensagens={aviso.mensagens}
            eventoInicial={eventoDaEtapa(os.status)}
            linkAcompanhamento={aviso.linkAcompanhamento}
            valores={{
              cliente: os.clienteNome?.trim().split(/\s+/)[0] ?? null,
              aparelho: [os.marca, os.modelo].filter(Boolean).join(' ') || ROTULO_APARELHO[os.aparelhoTipo] || 'aparelho',
              loja: ctx?.loja?.nome ?? null,
              numero_os: String(os.numero),
              valor: pagamento.total > 0 ? formatarReais(pagamento.total) : null,
              servico: orcamento.atual?.itens.map((i) => i.descricao).join(', ') || null,
              prazo_garantia: null,
              link: aviso.linkAcompanhamento,
            }}
          />
        </Cartao>
      )}

      {os.status === 'pronto' && !somenteLeitura && (
        <Cartao etiqueta="Saída do aparelho" titulo="Entrega">
          <EntregarOS
            osId={os.id}
            falta={falta}
            semCusto={pecas.semCusto}
            semOrcamentoAprovado={!os.interna && orcamento.atual?.status !== 'aprovado'}
          />
        </Cartao>
      )}

      {fechamento && (
        <Cartao etiqueta="Só você vê" titulo="Quanto sobrou">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
            <dt className="sobrancelha self-center">Cobrado</dt>
            <dd className="numeros text-right text-tinta">{formatarReais(fechamento.total)}</dd>
            <dt className="sobrancelha self-center">Custo das peças</dt>
            <dd className="numeros text-right text-tinta">− {formatarReais(fechamento.custoPecas)}</dd>
            <dt className="sobrancelha self-center">
              Comissão{fechamento.comissaoPercentual > 0 ? ` (${String(fechamento.comissaoPercentual).replace('.', ',')}%)` : ''}
            </dt>
            <dd className="numeros text-right text-tinta">− {formatarReais(fechamento.comissao)}</dd>
            <dt className="sobrancelha self-center border-t border-linha pt-2">Sobrou</dt>
            <dd
              className={`numeros border-t border-linha pt-2 text-right font-titulo text-2xl font-semibold ${
                fechamento.lucro < 0 ? 'text-perigo' : 'text-marca'
              }`}
            >
              {formatarReais(fechamento.lucro)}
            </dd>
          </dl>
          <p className="mt-3 text-sm text-tinta-suave">
            Valores fechados na entrega. Mudar a comissão ou um custo depois não altera esta OS.
          </p>
        </Cartao>
      )}

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
