'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import type { DadosGarantia } from '@/lib/configuracoes'
import { salvarCondicoes, salvarGarantia } from '../acoes'
import type { Msg } from './comum'
import { BotoesOrdem, mover, novaChave } from './lista'

type Prazos = { [K in keyof DadosGarantia]: number }

const PRAZOS: { chave: keyof Prazos; rotulo: string }[] = [
  { chave: 'garantiaServicoDias', rotulo: 'Serviço (padrão)' },
  { chave: 'garantiaNovoDias', rotulo: 'Venda de aparelho novo' },
  { chave: 'garantiaSeminovoDias', rotulo: 'Venda de seminovo' },
  { chave: 'garantiaAcessorioDias', rotulo: 'Venda de acessório' },
]

export function FormularioPrazos({ inicial, somenteLeitura }: { inicial: Prazos; somenteLeitura: boolean }) {
  const [valores, setValores] = useState(() =>
    Object.fromEntries(Object.entries(inicial).map(([k, v]) => [k, String(v)])) as Record<keyof Prazos, string>,
  )
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    const dados = Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim() === '' ? NaN : Number(v)])) as Prazos
    iniciar(async () => {
      const r = await salvarGarantia(dados)
      setMsg(r.ok ? { ok: true, texto: 'Prazos salvos.' } : { ok: false, texto: r.erro })
    })
  }

  return (
    <Cartao titulo="Prazos (em dias)">
      <form onSubmit={enviar}>
        <fieldset disabled={somenteLeitura} className="flex flex-col gap-4">
          <legend className="sr-only">Prazos de garantia em dias</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {PRAZOS.map((p) => (
              <Campo
                key={p.chave}
                name={p.chave}
                rotulo={p.rotulo}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                required
                value={valores[p.chave]}
                onChange={(e) => setValores({ ...valores, [p.chave]: e.target.value })}
              />
            ))}
          </div>
          <Retorno msg={msg} />
          <div>
            <Botao type="submit" disabled={pendente}>
              {pendente ? 'Salvando…' : 'Salvar prazos'}
            </Botao>
          </div>
        </fieldset>
      </form>
    </Cartao>
  )
}

type Linha = { chave: string; id?: string; texto: string }

export function FormularioCondicoes({ condicoes, somenteLeitura }: { condicoes: { id: string; texto: string }[]; somenteLeitura: boolean }) {
  const doBanco = () => condicoes.map((c) => ({ chave: c.id, id: c.id, texto: c.texto }))
  const [lista, setLista] = useState<Linha[]>(doBanco)
  const [base, setBase] = useState(condicoes)
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()

  // Depois de salvar, a página recarrega os dados: os itens novos ganham id do banco.
  if (base !== condicoes) {
    setBase(condicoes)
    setLista(doBanco())
  }

  const mudar = (i: number, texto: string) => setLista(lista.map((l, j) => (j === i ? { ...l, texto } : l)))

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    iniciar(async () => {
      const r = await salvarCondicoes(lista.map(({ id, texto }) => ({ id, texto })))
      setMsg(r.ok ? { ok: true, texto: 'Condições salvas.' } : { ok: false, texto: r.erro })
    })
  }

  return (
    <Cartao titulo="Condições que anulam a garantia">
      <form onSubmit={enviar}>
        <fieldset disabled={somenteLeitura} className="flex flex-col gap-4">
          <legend className="sr-only">Condições que anulam a garantia</legend>
          {lista.length === 0 ? (
            <p className="text-tinta-suave">Nenhuma condição. Adicione as situações em que a garantia não vale.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {lista.map((l, i) => (
                <li key={l.chave} className="flex items-center gap-1">
                  <label htmlFor={`condicao-${l.chave}`} className="sr-only">
                    Condição {i + 1}
                  </label>
                  <input
                    id={`condicao-${l.chave}`}
                    value={l.texto}
                    maxLength={200}
                    onChange={(e) => mudar(i, e.target.value)}
                    className="min-h-11 w-full min-w-0 rounded-lg border border-linha-forte bg-superficie px-3 text-base text-tinta disabled:bg-superficie-2"
                  />
                  <BotoesOrdem
                    nome={l.texto || `condição ${i + 1}`}
                    primeiro={i === 0}
                    ultimo={i === lista.length - 1}
                    aoMover={(passo) => setLista(mover(lista, i, passo))}
                  />
                  <Botao
                    variante="discreto"
                    className="shrink-0 px-3"
                    onClick={() => setLista(lista.filter((_, j) => j !== i))}
                    aria-label={`Remover ${l.texto || `condição ${i + 1}`}`}
                  >
                    Remover
                  </Botao>
                </li>
              ))}
            </ol>
          )}
          <div>
            <Botao variante="secundario" onClick={() => setLista([...lista, { chave: novaChave(), texto: '' }])}>
              Adicionar condição
            </Botao>
          </div>
          <Retorno msg={msg} />
          <div>
            <Botao type="submit" disabled={pendente}>
              {pendente ? 'Salvando…' : 'Salvar condições'}
            </Botao>
          </div>
        </fieldset>
      </form>
    </Cartao>
  )
}
