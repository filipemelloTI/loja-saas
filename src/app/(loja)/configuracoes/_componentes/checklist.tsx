'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { salvarChecklist } from '../acoes'
import type { Msg } from './comum'
import { BotoesOrdem, mover, novaChave } from './lista'

type Item = { id: string; nome: string; ativo: boolean }
type Linha = { chave: string; id?: string; nome: string; ativo: boolean }

export function FormularioChecklist({ itens, somenteLeitura }: { itens: Item[]; somenteLeitura: boolean }) {
  const doBanco = () => itens.map((i) => ({ chave: i.id, ...i }))
  const [lista, setLista] = useState<Linha[]>(doBanco)
  const [base, setBase] = useState(itens)
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()

  // Depois de salvar, a página recarrega os dados: os itens novos ganham id do banco
  // (sem isso, salvar de novo duplicaria os itens novos).
  if (base !== itens) {
    setBase(itens)
    setLista(doBanco())
  }

  const mudar = (i: number, parte: Partial<Linha>) => setLista(lista.map((l, j) => (j === i ? { ...l, ...parte } : l)))

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    iniciar(async () => {
      const r = await salvarChecklist(lista.map(({ id, nome, ativo }) => ({ id, nome, ativo })))
      setMsg(r.ok ? { ok: true, texto: 'Checklist salvo.' } : { ok: false, texto: r.erro })
    })
  }

  return (
    <Cartao titulo="Itens">
      <form onSubmit={enviar}>
        <fieldset disabled={somenteLeitura} className="flex flex-col gap-4">
          <legend className="sr-only">Itens do checklist de avarias</legend>
          {lista.length === 0 ? (
            <p className="text-tinta-suave">Nenhum item. Adicione o que a loja confere ao receber o aparelho.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {lista.map((l, i) => {
                const nome = l.nome || `item ${i + 1}`
                return (
                  <li key={l.chave} className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg border border-linha p-2 sm:flex-nowrap">
                    <label htmlFor={`item-${l.chave}`} className="sr-only">
                      Nome do item {i + 1}
                    </label>
                    <input
                      id={`item-${l.chave}`}
                      value={l.nome}
                      maxLength={80}
                      onChange={(e) => mudar(i, { nome: e.target.value })}
                      className={
                        'min-h-11 w-full min-w-0 rounded-lg border border-linha-forte bg-superficie px-3 text-base disabled:bg-superficie-2 sm:flex-1 ' +
                        (l.ativo ? 'text-tinta' : 'text-tinta-suave line-through')
                      }
                    />
                    <label className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-superficie-2">
                      <input
                        type="checkbox"
                        checked={l.ativo}
                        onChange={(e) => mudar(i, { ativo: e.target.checked })}
                        className="size-5 accent-marca"
                        aria-label={`${nome} ativo`}
                      />
                      <span aria-hidden="true">Ativo</span>
                    </label>
                    <BotoesOrdem
                      nome={nome}
                      primeiro={i === 0}
                      ultimo={i === lista.length - 1}
                      aoMover={(passo) => setLista(mover(lista, i, passo))}
                    />
                  </li>
                )
              })}
            </ol>
          )}
          <div>
            <Botao variante="secundario" onClick={() => setLista([...lista, { chave: novaChave(), nome: '', ativo: true }])}>
              Adicionar item
            </Botao>
          </div>
          <Retorno msg={msg} />
          <div>
            <Botao type="submit" disabled={pendente}>
              {pendente ? 'Salvando…' : 'Salvar checklist'}
            </Botao>
          </div>
        </fieldset>
      </form>
    </Cartao>
  )
}
