'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { formatarReais } from '@/lib/dinheiro'
import { responderOrcamento } from '../acoes'

type Msg = { ok: boolean; texto: string } | null

/** Aprovar ou recusar o orçamento. A aprovação pede o nome, que fica registrado como aceite. */
export function RespostaOrcamento({ token, orcamentoId, total }: { token: string; orcamentoId: string; total: number }) {
  const [nome, setNome] = useState('')
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [acao, setAcao] = useState<'aprovar' | 'recusar' | null>(null)
  const [confirmarRecusa, setConfirmarRecusa] = useState(false)

  function responder(aprova: boolean) {
    setMsg(null)
    setAcao(aprova ? 'aprovar' : 'recusar')
    iniciar(async () => {
      try {
        const r = await responderOrcamento(token, orcamentoId, aprova, nome)
        if (!r.ok) {
          setConfirmarRecusa(false)
          return setMsg({ ok: false, texto: r.erro })
        }
        setMsg({ ok: true, texto: aprova ? 'Orçamento aprovado. Obrigado!' : 'Resposta registrada.' })
      } catch {
        setMsg({ ok: false, texto: 'Não foi possível enviar agora. Confira sua internet e tente de novo.' })
      }
    })
  }

  function aprovar(e: FormEvent) {
    e.preventDefault()
    responder(true)
  }

  return (
    <form onSubmit={aprovar} className="flex flex-col gap-4">
      <Campo
        id="resposta-nome"
        name="nome"
        rotulo="Seu nome"
        required
        maxLength={80}
        autoComplete="name"
        dica="Fica registrado como o seu aceite do orçamento."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Botao type="submit" disabled={pendente} carregando={pendente && acao === 'aprovar'} rotuloCarregando="Enviando…">
        Aprovar {formatarReais(total)}
      </Botao>

      {confirmarRecusa ? (
        <div className="flex flex-col gap-2 rounded-lg border border-perigo bg-perigo-suave p-3">
          <p className="text-sobre-perigo-suave">Recusar o orçamento? A loja vai preparar o aparelho para devolver.</p>
          <div className="flex flex-wrap gap-2">
            <Botao
              variante="perigo"
              carregando={pendente && acao === 'recusar'}
              rotuloCarregando="Enviando…"
              onClick={() => responder(false)}
            >
              Confirmar recusa
            </Botao>
            <Botao variante="discreto" disabled={pendente} onClick={() => setConfirmarRecusa(false)}>
              Voltar
            </Botao>
          </div>
        </div>
      ) : (
        <Botao variante="discreto" disabled={pendente} onClick={() => setConfirmarRecusa(true)}>
          Recusar orçamento
        </Botao>
      )}

      <Retorno msg={msg} />
    </form>
  )
}
