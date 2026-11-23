'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { lerReais } from '@/lib/dinheiro'
import { FORMAS_PAGAMENTO, type FormaPagamento } from '@/lib/rotulos'
import { salvarConfigVendasOS } from '../acoes'
import { Marcar, type Msg } from './comum'

type Config = {
  orcamentoAlertaDias: number
  taxaAvaliacaoAtiva: boolean
  taxaAvaliacaoValor: number
  osNumeroInicial: number
  vendaNumeroInicial: number
  formasPagamento: FormaPagamento[]
  donoGeraComissao: boolean
  tecnicoVePropriaComissao: boolean
}

const FORMAS = Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]
const inteiro = (t: string) => (t.trim() === '' ? NaN : Number(t))

export function FormularioVendasOS({ inicial, somenteLeitura }: { inicial: Config; somenteLeitura: boolean }) {
  const [alerta, setAlerta] = useState(String(inicial.orcamentoAlertaDias))
  const [taxaAtiva, setTaxaAtiva] = useState(inicial.taxaAvaliacaoAtiva)
  const [taxa, setTaxa] = useState(inicial.taxaAvaliacaoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  const [osInicial, setOsInicial] = useState(String(inicial.osNumeroInicial))
  const [vendaInicial, setVendaInicial] = useState(String(inicial.vendaNumeroInicial))
  const [formas, setFormas] = useState(inicial.formasPagamento)
  const [donoComissao, setDonoComissao] = useState(inicial.donoGeraComissao)
  const [tecnicoVe, setTecnicoVe] = useState(inicial.tecnicoVePropriaComissao)
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()

  const alternarForma = (f: FormaPagamento, ligada: boolean) =>
    setFormas(ligada ? FORMAS.filter((x) => x === f || formas.includes(x)) : formas.filter((x) => x !== f))

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    iniciar(async () => {
      const r = await salvarConfigVendasOS({
        orcamentoAlertaDias: inteiro(alerta),
        taxaAvaliacaoAtiva: taxaAtiva,
        // Desligada, o valor não importa: guarda o que já estava para não travar em campo vazio.
        taxaAvaliacaoValor: taxaAtiva ? lerReais(taxa) : inicial.taxaAvaliacaoValor,
        osNumeroInicial: inteiro(osInicial),
        vendaNumeroInicial: inteiro(vendaInicial),
        formasPagamento: formas,
        donoGeraComissao: donoComissao,
        tecnicoVePropriaComissao: tecnicoVe,
      })
      setMsg(r.ok ? { ok: true, texto: 'Configurações salvas.' } : { ok: false, texto: r.erro })
    })
  }

  return (
    <form onSubmit={enviar}>
      <fieldset disabled={somenteLeitura} className="flex flex-col gap-5">
        <legend className="sr-only">Configurações de vendas e OS</legend>

        <Cartao titulo="Ordem de serviço">
          <div className="flex flex-col gap-4">
            <Campo
              name="orcamentoAlertaDias"
              rotulo="Alertar orçamento sem resposta depois de (dias)"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              value={alerta}
              onChange={(e) => setAlerta(e.target.value)}
            />
            <Marcar
              rotulo="Cobrar taxa de avaliação"
              checked={taxaAtiva}
              onChange={(e) => setTaxaAtiva(e.target.checked)}
            />
            {taxaAtiva && (
              <Campo
                name="taxaAvaliacaoValor"
                rotulo="Valor da taxa (R$)"
                inputMode="decimal"
                required
                value={taxa}
                onChange={(e) => setTaxa(e.target.value)}
              />
            )}
          </div>
        </Cartao>

        <Cartao titulo="Numeração">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              name="osNumeroInicial"
              rotulo="Número da primeira OS"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              dica="Para continuar a numeração do caderno ou sistema antigo."
              value={osInicial}
              onChange={(e) => setOsInicial(e.target.value)}
            />
            <Campo
              name="vendaNumeroInicial"
              rotulo="Número da primeira venda"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              value={vendaInicial}
              onChange={(e) => setVendaInicial(e.target.value)}
            />
          </div>
        </Cartao>

        <Cartao titulo="Formas de pagamento aceitas">
          <fieldset className="grid gap-1 sm:grid-cols-2">
            <legend className="sr-only">Formas de pagamento aceitas</legend>
            {FORMAS.map((f) => (
              <Marcar key={f} rotulo={FORMAS_PAGAMENTO[f]} checked={formas.includes(f)} onChange={(e) => alternarForma(f, e.target.checked)} />
            ))}
          </fieldset>
        </Cartao>

        <Cartao titulo="Comissão">
          <div className="flex flex-col gap-1">
            <Marcar
              rotulo="Dono gera comissão"
              dica="Serviços feitos pelo Dono entram no cálculo de comissão dele."
              checked={donoComissao}
              onChange={(e) => setDonoComissao(e.target.checked)}
            />
            <Marcar
              rotulo="Técnico vê a própria comissão"
              dica="Só o valor dele. Custo e margem continuam só com o Dono."
              checked={tecnicoVe}
              onChange={(e) => setTecnicoVe(e.target.checked)}
            />
          </div>
        </Cartao>

        <Retorno msg={msg} />
        <div>
          <Botao type="submit" disabled={pendente}>
            {pendente ? 'Salvando…' : 'Salvar configurações'}
          </Botao>
        </div>
      </fieldset>
    </form>
  )
}
