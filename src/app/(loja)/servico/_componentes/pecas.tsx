'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Selo } from '@/components/ui/Selo'
import { formatarReais, lerReais } from '@/lib/dinheiro'
import type { DadosPecas, Peca } from '@/lib/pecas-acoes'
import type { Resultado } from '@/lib/resultado'
import { adicionarPeca, removerPeca, salvarCustoPeca } from '../acoes'

type Msg = { ok: boolean; texto: string } | null

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function PecasDaOS({
  osId,
  dados,
  podeVerCusto,
  travadas,
  bloqueado,
}: {
  osId: string
  dados: DadosPecas
  /** Só o Dono, fora do modo suporte. */
  podeVerCusto: boolean
  /** Orçamento enviado ou aprovado: peça só muda com nova versão. */
  travadas: boolean
  /** OS encerrada ou modo suporte. */
  bloqueado: boolean
}) {
  const { pecas, semCusto } = dados
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [acao, setAcao] = useState<string | null>(null)
  const [descricao, setDescricao] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [preco, setPreco] = useState('')

  const mexer = !bloqueado && !travadas

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

  function adicionar(e: FormEvent) {
    e.preventDefault()
    const precoLido = lerReais(preco)
    if (Number.isNaN(precoLido)) return setMsg({ ok: false, texto: 'Informe o preço cobrado, por exemplo 350,00.' })
    executar(
      'nova',
      () => adicionarPeca(osId, { descricao, quantidade: Number(quantidade), precoUnitario: precoLido }),
      podeVerCusto ? 'Peça lançada. Preencha o custo dela quando souber.' : 'Peça lançada. O Dono preenche o custo.',
      () => {
        setDescricao('')
        setQuantidade('1')
        setPreco('')
      },
    )
  }

  return (
    <fieldset disabled={bloqueado} className="flex flex-col gap-5">
      <legend className="sr-only">Peças da OS</legend>

      {pecas.length === 0 ? (
        <p className="text-tinta-suave">
          {bloqueado ? 'Nenhuma peça usada nesta OS.' : 'Nenhuma peça lançada. Lance aqui as peças usadas no conserto.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-linha">
          {pecas.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words text-tinta">{p.descricao}</span>
                  <span className="numeros text-sm text-tinta-suave">
                    {p.quantidade} × {formatarReais(p.precoUnitario)}
                  </span>
                </div>
                <span className="numeros text-tinta">{formatarReais(p.quantidade * p.precoUnitario)}</span>
                {mexer && (
                  <Botao
                    variante="discreto"
                    disabled={pendente}
                    carregando={pendente && acao === `remover-${p.id}`}
                    rotuloCarregando="Removendo…"
                    onClick={() => executar(`remover-${p.id}`, () => removerPeca(p.id), 'Peça removida.')}
                    aria-label={`Remover ${p.descricao}`}
                  >
                    Remover
                  </Botao>
                )}
              </div>
              {podeVerCusto && (
                <CustoDaPeca
                  key={`${p.id}-${p.custoUnitario ?? 'pendente'}`}
                  peca={p}
                  pendente={pendente}
                  carregando={pendente && acao === `custo-${p.id}`}
                  salvar={(custo) => executar(`custo-${p.id}`, () => salvarCustoPeca(p.id, custo), 'Custo salvo.')}
                  avisarErro={(texto) => setMsg({ ok: false, texto })}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {semCusto > 0 && (
        <p className="rounded-lg bg-sinal-suave px-3 py-2 text-sobre-sinal-suave">
          {podeVerCusto
            ? `Preencha o custo de ${plural(semCusto, 'peça', 'peças')} antes da entrega.`
            : `${plural(semCusto, 'peça aguarda', 'peças aguardam')} o custo do Dono. A entrega só sai depois disso.`}
        </p>
      )}

      {!bloqueado && travadas && (
        <p className="text-sm text-tinta-suave">
          O orçamento já foi enviado. Para mudar as peças, use “Alterar orçamento” no bloco acima.
        </p>
      )}

      {mexer && (
        <form onSubmit={adicionar} className="flex flex-col gap-3 border-t border-linha pt-4">
          <p className="sobrancelha">Lançar peça</p>
          <Campo
            id="peca-descricao"
            name="descricao"
            rotulo="Peça"
            required
            maxLength={120}
            autoComplete="off"
            placeholder="Ex.: Tela iPhone 11"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Campo
              id="peca-quantidade"
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
              id="peca-preco"
              name="preco"
              rotulo="Preço cobrado (R$)"
              inputMode="decimal"
              required
              autoComplete="off"
              placeholder="0,00"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </div>
          <Botao
            type="submit"
            variante="secundario"
            className="self-start"
            disabled={pendente}
            carregando={pendente && acao === 'nova'}
            rotuloCarregando="Lançando…"
          >
            Lançar peça
          </Botao>
        </form>
      )}

      <Retorno msg={msg} />
    </fieldset>
  )
}

function CustoDaPeca({
  peca,
  pendente,
  carregando,
  salvar,
  avisarErro,
}: {
  peca: Peca
  pendente: boolean
  carregando: boolean
  salvar: (custo: number) => void
  avisarErro: (texto: string) => void
}) {
  const [editando, setEditando] = useState(peca.custoUnitario === null)
  const [valor, setValor] = useState(peca.custoUnitario === null ? '' : peca.custoUnitario.toFixed(2).replace('.', ','))

  function enviar(e: FormEvent) {
    e.preventDefault()
    const custo = lerReais(valor)
    if (Number.isNaN(custo)) return avisarErro('Informe o custo, por exemplo 280,00.')
    salvar(custo)
  }

  if (!editando && peca.custoUnitario !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="sobrancelha">Custo</span>
        <span className="numeros text-tinta">{formatarReais(peca.custoUnitario)}</span>
        <span className="text-tinta-suave">por unidade</span>
        <Botao variante="discreto" disabled={pendente} onClick={() => setEditando(true)} aria-label={`Corrigir o custo de ${peca.descricao}`}>
          Corrigir
        </Botao>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-2">
      {peca.custoUnitario === null && <Selo tom="aviso">Custo pendente</Selo>}
      <Campo
        id={`custo-${peca.id}`}
        name="custo"
        rotulo="Custo por unidade (R$)"
        inputMode="decimal"
        required
        autoComplete="off"
        placeholder="0,00"
        className="w-44"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <Botao type="submit" variante="secundario" disabled={pendente} carregando={carregando} rotuloCarregando="Salvando…">
        Salvar custo
      </Botao>
    </form>
  )
}
