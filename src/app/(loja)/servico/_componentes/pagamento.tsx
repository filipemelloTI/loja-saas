'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo, Rotulo } from '@/components/ui/Campo'
import { Selo } from '@/components/ui/Selo'
import { formatarReais, lerReais } from '@/lib/dinheiro'
import { formatarDataHora } from '@/lib/formatar'
import { rotuloForma } from '@/lib/rotulos'
import type { Resultado } from '@/lib/resultado'
import { registrarPagamento, removerPagamento } from '../acoes'
import type { DadosPagamentoOS } from '../dados'

type Msg = { ok: boolean; texto: string } | null

const CAIXA = 'min-h-11 w-full rounded-lg border border-linha-forte bg-superficie px-3 text-base text-tinta disabled:bg-superficie-2'
const centavos = (v: number) => Math.round(v * 100)
const paraCampo = (v: number) => v.toFixed(2).replace('.', ',')

export function PagamentoDaOS({
  osId,
  dados,
  pronta,
  bloqueado,
}: {
  osId: string
  dados: DadosPagamentoOS
  /** OS pronta: o que entra agora é pagamento final; antes disso, é sinal. */
  pronta: boolean
  /** OS encerrada ou modo suporte. */
  bloqueado: boolean
}) {
  const { pagamentos, total, formas, podeRemover } = dados
  const pago = pagamentos.reduce((t, p) => t + centavos(p.valor), 0) / 100
  const falta = Math.max(centavos(total) - centavos(pago), 0) / 100

  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [acao, setAcao] = useState<string | null>(null)
  const [forma, setForma] = useState(formas[0] ?? '')
  const [parcelas, setParcelas] = useState('1')
  // No pagamento final o valor já vem com o que falta; no sinal, quem decide é o cliente.
  const [valor, setValor] = useState(pronta && falta > 0 ? paraCampo(falta) : '')

  function executar(chave: string, chamada: () => Promise<Resultado>, sucesso: string, aoTerminar?: () => void) {
    setMsg(null)
    setAcao(chave)
    iniciar(async () => {
      try {
        const r = await chamada()
        if (!r.ok) return setMsg({ ok: false, texto: r.erro })
        aoTerminar?.()
        setMsg({ ok: true, texto: sucesso })
      } catch {
        setMsg({ ok: false, texto: 'Não foi possível salvar agora. Confira sua conexão e tente de novo.' })
      }
    })
  }

  function registrar(e: FormEvent) {
    e.preventDefault()
    const lido = lerReais(valor)
    if (Number.isNaN(lido)) return setMsg({ ok: false, texto: 'Informe o valor recebido, por exemplo 150,00.' })
    executar(
      'registrar',
      () =>
        registrarPagamento(osId, {
          forma,
          valor: lido,
          parcelas: forma === 'credito' ? Number(parcelas) : undefined,
        }),
      pronta ? 'Pagamento registrado.' : 'Sinal registrado.',
      () => setValor(''),
    )
  }

  if (total <= 0 && pagamentos.length === 0) {
    return <p className="text-tinta-suave">O pagamento aparece aqui depois que o orçamento tiver itens.</p>
  }

  return (
    <fieldset disabled={bloqueado} className="flex flex-col gap-5">
      <legend className="sr-only">Pagamento da OS</legend>

      <dl className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <dt className="sobrancelha">Total</dt>
          <dd className="numeros font-titulo text-xl font-semibold text-tinta">{formatarReais(total)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="sobrancelha">Pago</dt>
          <dd className="numeros font-titulo text-xl font-semibold text-tinta">{formatarReais(pago)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="sobrancelha">Falta</dt>
          <dd className={`numeros font-titulo text-xl font-semibold ${falta > 0 ? 'text-sinal' : 'text-marca'}`}>
            {formatarReais(falta)}
          </dd>
        </div>
      </dl>

      {pagamentos.length > 0 && (
        <ul className="flex flex-col divide-y divide-linha">
          {pagamentos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2 text-tinta">
                  <Selo tom={p.tipo === 'sinal' ? 'aviso' : 'info'}>{p.tipo === 'sinal' ? 'Sinal' : 'Pagamento'}</Selo>
                  {rotuloForma(p.forma)}
                  {p.parcelas && <span className="numeros text-tinta-suave">em {p.parcelas}x</span>}
                </span>
                <span className="numeros text-sm text-tinta-suave">{formatarDataHora(p.registradoEm)}</span>
              </div>
              <span className="numeros text-tinta">{formatarReais(p.valor)}</span>
              {podeRemover && !bloqueado && (
                <Botao
                  variante="discreto"
                  disabled={pendente}
                  carregando={pendente && acao === p.id}
                  rotuloCarregando="Removendo…"
                  onClick={() => executar(p.id, () => removerPagamento(p.id), 'Pagamento removido.')}
                  aria-label={`Remover pagamento de ${formatarReais(p.valor)}`}
                >
                  Remover
                </Botao>
              )}
            </li>
          ))}
        </ul>
      )}

      {!bloqueado && falta > 0 && formas.length > 0 && (
        <form onSubmit={registrar} className="flex flex-col gap-3 border-t border-linha pt-4">
          <p className="sobrancelha">{pronta ? 'Receber' : 'Receber sinal'}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Rotulo htmlFor="pag-forma">Forma</Rotulo>
              <select id="pag-forma" required value={forma} onChange={(e) => setForma(e.target.value)} className={CAIXA}>
                {formas.map((f) => (
                  <option key={f} value={f}>
                    {rotuloForma(f)}
                  </option>
                ))}
              </select>
            </div>
            {forma === 'credito' && (
              <Campo
                id="pag-parcelas"
                name="parcelas"
                rotulo="Parcelas"
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                required
                value={parcelas}
                onChange={(e) => setParcelas(e.target.value)}
              />
            )}
            <Campo
              id="pag-valor"
              name="valor"
              rotulo="Valor (R$)"
              inputMode="decimal"
              required
              autoComplete="off"
              placeholder="0,00"
              dica={pronta ? `Falta ${formatarReais(falta)}.` : 'O sinal é abatido na entrega.'}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <Botao
            type="submit"
            className="self-start"
            disabled={pendente}
            carregando={pendente && acao === 'registrar'}
            rotuloCarregando="Registrando…"
          >
            {pronta ? 'Registrar pagamento' : 'Registrar sinal'}
          </Botao>
        </form>
      )}

      {!bloqueado && falta <= 0 && total > 0 && <p className="text-marca-forte">Tudo pago.</p>}
      {!bloqueado && formas.length === 0 && (
        <p className="text-tinta-suave">A loja não tem forma de pagamento ativa. O Dono liga as formas em Configurações.</p>
      )}

      <Retorno msg={msg} />
    </fieldset>
  )
}
