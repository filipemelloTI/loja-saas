'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { MENSAGEM_PADRAO, ROTULO_EVENTO, VARIAVEIS_EVENTO, type Evento } from '@/lib/mensagens'
import { restaurarMensagemPadrao, salvarMensagem } from '../acoes'
import { CLASSE_TEXTO_LONGO, type Msg } from './comum'

type Props = { evento: Evento; texto: string; somenteLeitura: boolean }

export function EditorMensagem({ evento, texto: inicial, somenteLeitura }: Props) {
  const [texto, setTexto] = useState(inicial)
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const caixa = useRef<HTMLTextAreaElement>(null)
  const id = `mensagem-${evento}`

  /** Põe `{variavel}` onde está o cursor (ou no fim) e devolve o foco à caixa. */
  function inserir(variavel: string) {
    const el = caixa.current
    const trecho = `{${variavel}}`
    const inicio = el?.selectionStart ?? texto.length
    const fim = el?.selectionEnd ?? texto.length
    setTexto(texto.slice(0, inicio) + trecho + texto.slice(fim))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(inicio + trecho.length, inicio + trecho.length)
    })
  }

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    iniciar(async () => {
      const r = await salvarMensagem(evento, texto)
      setMsg(r.ok ? { ok: true, texto: 'Mensagem salva.' } : { ok: false, texto: r.erro })
    })
  }

  function restaurar() {
    setMsg(null)
    iniciar(async () => {
      const r = await restaurarMensagemPadrao(evento)
      if (r.ok) setTexto(MENSAGEM_PADRAO[evento])
      setMsg(r.ok ? { ok: true, texto: 'Texto padrão restaurado.' } : { ok: false, texto: r.erro })
    })
  }

  return (
    <Cartao titulo={ROTULO_EVENTO[evento]}>
      <form onSubmit={salvar}>
        <fieldset disabled={somenteLeitura} className="flex flex-col gap-3">
          <legend className="sr-only">Mensagem: {ROTULO_EVENTO[evento]}</legend>
          <label htmlFor={id} className="sr-only">
            Texto da mensagem
          </label>
          <textarea
            ref={caixa}
            id={id}
            rows={4}
            maxLength={1000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={CLASSE_TEXTO_LONGO}
          />
          <div className="flex flex-col gap-1.5">
            <p id={`${id}-variaveis`} className="text-sm font-semibold text-tinta">
              Inserir no texto
            </p>
            <div role="group" aria-labelledby={`${id}-variaveis`} className="flex flex-wrap gap-1.5">
              {VARIAVEIS_EVENTO[evento].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => inserir(v)}
                  className="min-h-11 rounded-lg border border-linha-forte bg-superficie px-3 font-mono text-sm text-tinta hover:bg-superficie-2 disabled:opacity-50"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>
          <Retorno msg={msg} />
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" disabled={pendente || texto === inicial}>
              {pendente ? 'Salvando…' : 'Salvar mensagem'}
            </Botao>
            <Botao variante="discreto" onClick={restaurar} disabled={pendente || texto === MENSAGEM_PADRAO[evento]}>
              Restaurar padrão
            </Botao>
          </div>
        </fieldset>
      </form>
    </Cartao>
  )
}
