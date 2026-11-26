'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo, Rotulo } from '@/components/ui/Campo'
import { Selo, type TomSelo } from '@/components/ui/Selo'
import { formatarReais, lerReais } from '@/lib/dinheiro'
import { formatarDataHora } from '@/lib/formatar'
import { calcularTotalOrcamento } from '@/lib/orcamento'
import type { DadosOrcamento, MeioAprovacao, StatusOrcamento } from '@/lib/orcamento-acoes'
import type { Resultado } from '@/lib/resultado'
import {
  adicionarItemOrcamento,
  aprovarOrcamento,
  enviarOrcamento,
  novaVersaoOrcamento,
  recusarOrcamento,
  removerItemOrcamento,
  salvarDescontoOrcamento,
} from '../acoes'
import type { ServicoCatalogo } from '../dados'

type Msg = { ok: boolean; texto: string } | null

const CAIXA = 'min-h-11 w-full rounded-lg border border-linha-forte bg-superficie px-3 text-base text-tinta disabled:bg-superficie-2'

export const ROTULO_ORCAMENTO: Record<StatusOrcamento, { rotulo: string; tom: TomSelo }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutro' },
  enviado: { rotulo: 'Aguardando cliente', tom: 'aviso' },
  aprovado: { rotulo: 'Aprovado', tom: 'info' },
  recusado: { rotulo: 'Recusado', tom: 'perigo' },
  substituido: { rotulo: 'Substituído', tom: 'neutro' },
}

const MEIOS: { valor: MeioAprovacao; rotulo: string; frase: string }[] = [
  { valor: 'balcao', rotulo: 'No balcão', frase: 'no balcão' },
  { valor: 'telefone', rotulo: 'Por telefone', frase: 'por telefone' },
  { valor: 'whatsapp', rotulo: 'Pelo WhatsApp', frase: 'pelo WhatsApp' },
  { valor: 'outro', rotulo: 'Outro meio', frase: 'por outro meio' },
]

type Acao = 'item' | 'remover' | 'desconto' | 'enviar' | 'aprovar' | 'recusar' | 'versao'

export function OrcamentoDaOS({
  osId,
  dados,
  servicos,
  bloqueado,
}: {
  osId: string
  dados: DadosOrcamento
  servicos: ServicoCatalogo[]
  /** OS encerrada ou modo suporte: só leitura. */
  bloqueado: boolean
}) {
  const { atual, anteriores, pecas } = dados
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [acao, setAcao] = useState<{ tipo: Acao; id?: string } | null>(null)
  const [confirmar, setConfirmar] = useState<'recusar' | 'versao' | null>(null)

  const [servicoId, setServicoId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [preco, setPreco] = useState('')

  const tipoInicial = atual?.descontoValor != null ? 'valor' : atual?.descontoPercentual != null ? 'percentual' : 'nenhum'
  const [tipoDesconto, setTipoDesconto] = useState<'nenhum' | 'valor' | 'percentual'>(tipoInicial)
  const [valorDesconto, setValorDesconto] = useState(
    String(atual?.descontoValor ?? atual?.descontoPercentual ?? '').replace('.', ','),
  )

  const [por, setPor] = useState('')
  const [meio, setMeio] = useState<MeioAprovacao | ''>('')

  const status = atual?.status ?? 'rascunho'
  const editavel = !bloqueado && status === 'rascunho'
  const temConteudo = (atual?.itens.length ?? 0) + pecas.length > 0
  const conta = calcularTotalOrcamento({
    itens: atual?.itens ?? [],
    pecas,
    descontoValor: atual?.descontoValor,
    descontoPercentual: atual?.descontoPercentual,
  })

  function executar(tipo: Acao, chamada: () => Promise<Resultado>, sucesso: string, aoTerminar?: () => void, id?: string) {
    setMsg(null)
    setAcao({ tipo, id })
    iniciar(async () => {
      try {
        const r = await chamada()
        if (!r.ok) return setMsg({ ok: false, texto: r.erro })
        setConfirmar(null)
        aoTerminar?.()
        setMsg({ ok: true, texto: sucesso })
      } catch {
        setMsg({ ok: false, texto: 'Não foi possível salvar agora. Confira sua conexão e tente de novo.' })
      }
    })
  }

  const carregando = (tipo: Acao, id?: string) => pendente && acao?.tipo === tipo && (id === undefined || acao.id === id)

  function escolherServico(id: string) {
    setServicoId(id)
    const s = servicos.find((x) => x.id === id)
    if (s) {
      setDescricao(s.nome)
      setPreco(s.preco.toFixed(2).replace('.', ','))
    }
  }

  function adicionar(e: FormEvent) {
    e.preventDefault()
    const precoLido = lerReais(preco)
    if (Number.isNaN(precoLido)) return setMsg({ ok: false, texto: 'Informe o preço, por exemplo 150,00.' })
    executar(
      'item',
      () =>
        adicionarItemOrcamento(osId, {
          descricao,
          quantidade: Number(quantidade),
          precoUnitario: precoLido,
          servicoId: servicoId || undefined,
        }),
      'Item lançado.',
      () => {
        setServicoId('')
        setDescricao('')
        setQuantidade('1')
        setPreco('')
      },
    )
  }

  function salvarDesconto(e: FormEvent) {
    e.preventDefault()
    if (!atual) return
    if (tipoDesconto === 'nenhum')
      return executar('desconto', () => salvarDescontoOrcamento(atual.id, { tipo: 'nenhum' }), 'Desconto removido.')
    const valor = lerReais(valorDesconto)
    if (Number.isNaN(valor)) return setMsg({ ok: false, texto: 'Informe o valor do desconto, por exemplo 50 ou 10.' })
    executar('desconto', () => salvarDescontoOrcamento(atual.id, { tipo: tipoDesconto, valor }), 'Desconto salvo.')
  }

  function aprovar(e: FormEvent) {
    e.preventDefault()
    if (!atual) return
    if (!meio) return setMsg({ ok: false, texto: 'Informe como o cliente aprovou.' })
    executar('aprovar', () => aprovarOrcamento(atual.id, { por, meio }), 'Aprovação registrada. A OS passou para “Aprovado”.', () => {
      setPor('')
      setMeio('')
    })
  }

  const meioFrase = MEIOS.find((m) => m.valor === atual?.aprovadoMeio)?.frase

  return (
    <fieldset disabled={bloqueado} className="flex flex-col gap-5">
      <legend className="sr-only">Orçamento da OS</legend>

      {atual && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="sobrancelha">Versão {atual.versao}</span>
          <Selo tom={ROTULO_ORCAMENTO[status].tom}>{ROTULO_ORCAMENTO[status].rotulo}</Selo>
        </div>
      )}

      {!temConteudo ? (
        <p className="text-tinta-suave">
          {bloqueado ? 'Esta OS não teve orçamento.' : 'Nenhum item ainda. Lance o primeiro item abaixo para começar o orçamento.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y divide-linha">
            {atual?.itens.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words text-tinta">{i.descricao}</span>
                  <span className="numeros text-sm text-tinta-suave">
                    {i.quantidade} × {formatarReais(i.precoUnitario)}
                  </span>
                </div>
                <span className="numeros text-tinta">{formatarReais(i.quantidade * i.precoUnitario)}</span>
                {editavel && (
                  <Botao
                    variante="discreto"
                    disabled={pendente}
                    carregando={carregando('remover', i.id)}
                    rotuloCarregando="Removendo…"
                    onClick={() => executar('remover', () => removerItemOrcamento(i.id), 'Item removido.', undefined, i.id)}
                    aria-label={`Remover ${i.descricao}`}
                  >
                    Remover
                  </Botao>
                )}
              </li>
            ))}
            {pecas.map((p, n) => (
              <li key={`peca-${n}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words text-tinta">
                    {p.descricao} <span className="sobrancelha">Peça</span>
                  </span>
                  <span className="numeros text-sm text-tinta-suave">
                    {p.quantidade} × {formatarReais(p.precoUnitario)}
                  </span>
                </div>
                <span className="numeros text-tinta">{formatarReais(p.quantidade * p.precoUnitario)}</span>
              </li>
            ))}
          </ul>

          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-linha pt-3">
            {conta.desconto > 0 && (
              <>
                <dt className="sobrancelha self-center">Subtotal</dt>
                <dd className="numeros text-right text-tinta-suave">{formatarReais(conta.subtotal)}</dd>
                <dt className="sobrancelha self-center">
                  Desconto{atual?.descontoPercentual != null ? ` (${String(atual.descontoPercentual).replace('.', ',')}%)` : ''}
                </dt>
                <dd className="numeros text-right text-tinta-suave">− {formatarReais(conta.desconto)}</dd>
              </>
            )}
            <dt className="sobrancelha self-center">Total</dt>
            <dd className="numeros text-right font-titulo text-2xl font-semibold text-tinta">{formatarReais(conta.total)}</dd>
          </dl>
        </div>
      )}

      {status === 'aprovado' && atual?.aprovadoEm && (
        <p className="rounded-lg bg-marca-suave px-3 py-2 text-marca-forte">
          Aprovado por <strong>{atual.aprovadoPor}</strong> {meioFrase} em{' '}
          <span className="numeros">{formatarDataHora(atual.aprovadoEm)}</span>.
        </p>
      )}
      {status === 'recusado' && atual?.recusadoEm && (
        <p className="rounded-lg bg-perigo-suave px-3 py-2 text-sobre-perigo-suave">
          O cliente recusou em <span className="numeros">{formatarDataHora(atual.recusadoEm)}</span>. Siga pela etapa
          “Pronto para devolver”.
        </p>
      )}

      {editavel && (
        <form onSubmit={adicionar} className="flex flex-col gap-3 border-t border-linha pt-4">
          <p className="sobrancelha">Lançar item</p>
          {servicos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Rotulo htmlFor="orc-servico" opcional>
                Do catálogo
              </Rotulo>
              <select id="orc-servico" value={servicoId} onChange={(e) => escolherServico(e.target.value)} className={CAIXA}>
                <option value="">Escolha um serviço para preencher</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} · {formatarReais(s.preco)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Campo
            id="orc-descricao"
            name="descricao"
            rotulo="Descrição"
            required
            maxLength={120}
            autoComplete="off"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Campo
              id="orc-quantidade"
              name="quantidade"
              rotulo="Qtd."
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              required
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
            <Campo
              id="orc-preco"
              name="preco"
              rotulo="Preço (R$)"
              inputMode="decimal"
              required
              autoComplete="off"
              placeholder="0,00"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </div>
          <Botao type="submit" variante="secundario" className="self-start" carregando={carregando('item')} rotuloCarregando="Lançando…" disabled={pendente}>
            Lançar item
          </Botao>
        </form>
      )}

      {editavel && atual && temConteudo && (
        <form onSubmit={salvarDesconto} className="flex flex-col gap-3 border-t border-linha pt-4">
          <p className="sobrancelha">Desconto</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Rotulo htmlFor="orc-tipo-desconto">Tipo</Rotulo>
              <select
                id="orc-tipo-desconto"
                value={tipoDesconto}
                onChange={(e) => setTipoDesconto(e.target.value as typeof tipoDesconto)}
                className={CAIXA}
              >
                <option value="nenhum">Sem desconto</option>
                <option value="valor">Em reais</option>
                <option value="percentual">Em porcentagem</option>
              </select>
            </div>
            {tipoDesconto !== 'nenhum' && (
              <Campo
                id="orc-valor-desconto"
                name="valorDesconto"
                rotulo={tipoDesconto === 'valor' ? 'Valor (R$)' : 'Porcentagem (%)'}
                inputMode="decimal"
                required
                autoComplete="off"
                value={valorDesconto}
                onChange={(e) => setValorDesconto(e.target.value)}
              />
            )}
          </div>
          <Botao type="submit" variante="secundario" className="self-start" carregando={carregando('desconto')} rotuloCarregando="Salvando…" disabled={pendente}>
            Salvar desconto
          </Botao>
        </form>
      )}

      {!bloqueado && atual && temConteudo && (status === 'rascunho' || status === 'enviado') && (
        <form onSubmit={aprovar} className="flex flex-col gap-3 border-t border-linha pt-4">
          <p className="sobrancelha">Resposta do cliente</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              id="orc-por"
              name="por"
              rotulo="Quem aprovou"
              required
              maxLength={80}
              autoComplete="off"
              dica="O cliente, ou quem falou por ele."
              value={por}
              onChange={(e) => setPor(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <Rotulo htmlFor="orc-meio">Como aprovou</Rotulo>
              <select id="orc-meio" required value={meio} onChange={(e) => setMeio(e.target.value as MeioAprovacao)} className={CAIXA}>
                <option value="">Escolha</option>
                {MEIOS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" carregando={carregando('aprovar')} rotuloCarregando="Registrando…" disabled={pendente}>
              Registrar aprovação
            </Botao>
            {status === 'rascunho' && (
              <Botao
                variante="secundario"
                disabled={pendente}
                carregando={carregando('enviar')}
                rotuloCarregando="Marcando…"
                onClick={() => executar('enviar', () => enviarOrcamento(atual.id), 'Orçamento marcado como enviado. A OS aguarda a resposta do cliente.')}
              >
                Marcar como enviado
              </Botao>
            )}
            {status === 'enviado' && confirmar !== 'recusar' && (
              <Botao variante="perigo" disabled={pendente} onClick={() => setConfirmar('recusar')}>
                Cliente recusou
              </Botao>
            )}
          </div>
          {status === 'enviado' && confirmar === 'recusar' && (
            <div className="flex flex-col gap-2 rounded-lg border border-perigo bg-perigo-suave p-3">
              <p className="text-sobre-perigo-suave">A OS vai para “Recusado” e o aparelho volta para o cliente. Confirma?</p>
              <div className="flex flex-wrap gap-2">
                <Botao
                  variante="perigo"
                  carregando={carregando('recusar')}
                  rotuloCarregando="Registrando…"
                  onClick={() => executar('recusar', () => recusarOrcamento(atual.id), 'Recusa registrada.')}
                >
                  Confirmar recusa
                </Botao>
                <Botao variante="discreto" disabled={pendente} onClick={() => setConfirmar(null)}>
                  Cancelar
                </Botao>
              </div>
            </div>
          )}
        </form>
      )}

      {!bloqueado && atual && (status === 'enviado' || status === 'aprovado') && (
        <div className="flex flex-col gap-2 border-t border-linha pt-4">
          {confirmar === 'versao' ? (
            <div className="flex flex-col gap-2 rounded-lg border border-sinal bg-sinal-suave p-3">
              <p className="text-sobre-sinal-suave">
                Cria a versão {atual.versao + 1} com os mesmos itens para você ajustar.
                {status === 'aprovado' && ' A aprovação atual deixa de valer e a OS volta para “Orçamento enviado”.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Botao
                  variante="secundario"
                  carregando={carregando('versao')}
                  rotuloCarregando="Criando…"
                  onClick={() => executar('versao', () => novaVersaoOrcamento(atual.id), `Versão ${atual.versao + 1} criada. Ajuste e registre a nova resposta.`)}
                >
                  Criar versão {atual.versao + 1}
                </Botao>
                <Botao variante="discreto" disabled={pendente} onClick={() => setConfirmar(null)}>
                  Cancelar
                </Botao>
              </div>
            </div>
          ) : (
            <Botao variante="discreto" className="self-start" disabled={pendente} onClick={() => setConfirmar('versao')}>
              Alterar orçamento
            </Botao>
          )}
        </div>
      )}

      <Retorno msg={msg} />

      {anteriores.length > 0 && (
        <details className="border-t border-linha pt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-tinta-suave">
            Versões anteriores ({anteriores.length})
          </summary>
          <ul className="flex flex-col gap-1 pt-1">
            {anteriores.map((v) => (
              <li key={v.versao} className="flex items-center gap-2 text-sm">
                <span className="numeros text-tinta">Versão {v.versao}</span>
                <Selo tom={ROTULO_ORCAMENTO[v.status].tom}>{ROTULO_ORCAMENTO[v.status].rotulo}</Selo>
              </li>
            ))}
          </ul>
        </details>
      )}
    </fieldset>
  )
}
