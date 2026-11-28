import { Suspense } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Roda } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { Selo } from '@/components/ui/Selo'
import { lerAcompanhamento, tokenValido, type Acompanhamento } from '@/lib/acompanhamento'
import { formatarReais } from '@/lib/dinheiro'
import { formatarData, formatarDataHora, formatarDataISO, formatarTelefone } from '@/lib/formatar'
import { ROTULO_STATUS } from '@/lib/os-status'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteAnonimo } from '@/lib/supabase/anonimo'
import { RespostaOrcamento } from './resposta'

// Página do cliente da loja: o nome é o da loja, nunca o do sistema, e não vai para buscadores.
export const metadata: Metadata = {
  title: { absolute: 'Acompanhe seu conserto' },
  robots: { index: false, follow: false },
}

export default function PaginaAcompanhamento({ params }: PageProps<'/acompanhar/[token]'>) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6 sm:py-10">
      <Suspense
        fallback={
          <p role="status" className="flex items-center gap-2 text-tinta-suave">
            <Roda /> Carregando…
          </p>
        }
      >
        <Conteudo params={params} />
      </Suspense>
    </main>
  )
}

async function Conteudo({ params }: { params: PageProps<'/acompanhar/[token]'>['params'] }) {
  const { token } = await params
  if (!tokenValido(token)) notFound()

  const { data } = await criarClienteAnonimo().rpc('acompanhamento_os', { token })
  const a = lerAcompanhamento(data)
  if (!a) {
    return (
      <Cartao titulo="Link não encontrado">
        <p className="text-tinta-suave">Confira se o link está completo ou peça um novo à loja.</p>
      </Cartao>
    )
  }

  // O bucket de logos é privado: a assinatura é feita no servidor e vale uma hora.
  const logo = a.loja.logoPath
    ? ((await criarClienteAdmin().storage.from('logos').createSignedUrl(a.loja.logoPath, 60 * 60)).data?.signedUrl ?? null)
    : null

  return <Tela a={a} token={token} logo={logo} />
}

function Tela({ a, token, logo }: { a: Acompanhamento; token: string; logo: string | null }) {
  const status = ROTULO_STATUS[a.os.status]
  const orc = a.orcamento

  return (
    <>
      <header className="flex items-center gap-3">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do armazenamento
          <img src={logo} alt="" className="size-12 rounded-lg border border-linha object-contain" />
        )}
        <p className="font-titulo text-2xl font-bold tracking-tight text-tinta">{a.loja.nome}</p>
      </header>

      <section className="flex flex-col gap-2">
        {a.cliente && <p className="text-tinta-suave">Olá, {a.cliente}!</p>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-titulo text-3xl font-bold tracking-tight">
            OS <span className="numeros">Nº {a.os.numero}</span>
          </h1>
          <Selo tom={status?.tom}>{status?.rotulo ?? 'Em andamento'}</Selo>
        </div>
        <p className="text-tinta">{a.os.aparelho}</p>
        {a.os.previsaoEntrega && !a.os.encerradaEm && (
          <p className="text-sm text-tinta-suave">
            Previsão: <span className="numeros">{formatarDataISO(a.os.previsaoEntrega)}</span>
          </p>
        )}
      </section>

      {orc && (
        <Cartao etiqueta={`Versão ${orc.versao}`} titulo="Orçamento">
          <ul className="flex flex-col divide-y divide-linha">
            {[...orc.itens, ...a.pecas].map((l, n) => (
              <li key={n} className="flex items-center gap-3 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words text-tinta">{l.descricao}</span>
                  {l.quantidade > 1 && (
                    <span className="numeros text-sm text-tinta-suave">
                      {l.quantidade} × {formatarReais(l.precoUnitario)}
                    </span>
                  )}
                </div>
                <span className="numeros text-tinta">{formatarReais(l.quantidade * l.precoUnitario)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-linha pt-3">
            {a.conta.desconto > 0 && (
              <>
                <dt className="sobrancelha self-center">Desconto</dt>
                <dd className="numeros text-right text-tinta-suave">− {formatarReais(a.conta.desconto)}</dd>
              </>
            )}
            <dt className="sobrancelha self-center">Total</dt>
            <dd className="numeros text-right font-titulo text-2xl font-semibold text-tinta">
              {formatarReais(orc.status === 'recusado' ? 0 : a.conta.total)}
            </dd>
          </dl>

          <div className="mt-4">
            {orc.status === 'enviado' && <RespostaOrcamento token={token} orcamentoId={orc.id} total={a.conta.total} />}
            {orc.status === 'aprovado' && orc.aprovadoEm && (
              <p className="rounded-lg bg-marca-suave px-3 py-2 text-marca-forte">
                Aprovado em <span className="numeros">{formatarDataHora(orc.aprovadoEm)}</span>.
              </p>
            )}
            {orc.status === 'recusado' && orc.recusadoEm && (
              <p className="rounded-lg bg-superficie-2 px-3 py-2 text-tinta-suave">
                Orçamento recusado em <span className="numeros">{formatarDataHora(orc.recusadoEm)}</span>.
              </p>
            )}
          </div>
        </Cartao>
      )}

      {a.conta.total > 0 && a.conta.pago > 0 && (
        <Cartao titulo="Pagamento">
          <dl className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <dt className="sobrancelha">Total</dt>
              <dd className="numeros font-semibold text-tinta">{formatarReais(a.conta.total)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="sobrancelha">Pago</dt>
              <dd className="numeros font-semibold text-tinta">{formatarReais(a.conta.pago)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="sobrancelha">Falta</dt>
              <dd className="numeros font-semibold text-tinta">{formatarReais(a.conta.falta)}</dd>
            </div>
          </dl>
        </Cartao>
      )}

      {a.garantia && (
        <Cartao titulo="Garantia">
          <p className="text-tinta">
            <span className="numeros">{a.garantia.dias}</span> dias, até{' '}
            <span className="numeros font-semibold">{formatarDataISO(a.garantia.venceEm)}</span>.
          </p>
          {a.garantia.condicoes.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              <p className="sobrancelha">A garantia não cobre</p>
              <ul className="list-disc pl-5 text-sm text-tinta-suave">
                {a.garantia.condicoes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </Cartao>
      )}

      <section aria-labelledby="andamento" className="flex flex-col gap-3">
        <h2 id="andamento" className="font-titulo text-lg font-semibold text-tinta">
          Andamento
        </h2>
        <ol className="flex flex-col border-l-2 border-linha-forte">
          {a.historico.map((h, i) => (
            <li key={i} className="relative flex flex-col gap-1 pb-4 pl-5 last:pb-0">
              <span aria-hidden="true" className="absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-papel bg-marca" />
              <Selo tom={ROTULO_STATUS[h.status]?.tom}>{ROTULO_STATUS[h.status]?.rotulo ?? 'Em andamento'}</Selo>
              <span className="numeros text-sm text-tinta-suave">{formatarDataHora(h.em)}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-tinta-suave">
          Aparelho recebido em <span className="numeros">{formatarData(a.os.criadoEm)}</span>.
        </p>
      </section>

      {(a.loja.telefone || a.loja.endereco) && (
        <Cartao etiqueta="Fale com a loja" titulo={a.loja.nome}>
          <dl className="flex flex-col gap-2">
            {a.loja.telefone && (
              <div className="flex flex-col">
                <dt className="sobrancelha">Telefone</dt>
                <dd className="numeros select-all text-tinta">{formatarTelefone(a.loja.telefone)}</dd>
              </div>
            )}
            {a.loja.endereco && (
              <div className="flex flex-col">
                <dt className="sobrancelha">Endereço</dt>
                <dd className="text-tinta">{a.loja.endereco}</dd>
              </div>
            )}
          </dl>
        </Cartao>
      )}
    </>
  )
}
