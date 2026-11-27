'use client'

import { useState, useTransition } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { formatarReais } from '@/lib/dinheiro'
import { entregarOS } from '../acoes'

type Msg = { ok: boolean; texto: string } | null

/**
 * Entrega da OS pronta. A lista de pendências é só um aviso adiantado: quem decide é a função do
 * banco, que confere tudo de novo e devolve o que faltar.
 */
export function EntregarOS({
  osId,
  falta,
  semCusto,
  semOrcamentoAprovado,
}: {
  osId: string
  falta: number
  semCusto: number
  semOrcamentoAprovado: boolean
}) {
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [confirmando, setConfirmando] = useState(false)

  const pendencias = [
    semOrcamentoAprovado && 'O orçamento ainda não foi aprovado.',
    semCusto > 0 && `O Dono precisa preencher o custo de ${semCusto === 1 ? '1 peça' : `${semCusto} peças`}.`,
    falta > 0 && `Falta receber ${formatarReais(falta)}.`,
  ].filter((p): p is string => !!p)

  function entregar() {
    setMsg(null)
    iniciar(async () => {
      try {
        const r = await entregarOS(osId)
        if (!r.ok) {
          setConfirmando(false)
          return setMsg({ ok: false, texto: r.erro })
        }
        setMsg({ ok: true, texto: 'Aparelho entregue. A OS foi encerrada.' })
      } catch {
        setMsg({ ok: false, texto: 'Não foi possível entregar agora. Confira sua conexão e tente de novo.' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {pendencias.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-lg bg-sinal-suave px-3 py-2 text-sobre-sinal-suave">
          <p className="font-semibold">Antes de entregar:</p>
          <ul className="list-disc pl-5">
            {pendencias.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-tinta-suave">Tudo certo: orçamento aprovado, custos preenchidos e pagamento completo.</p>
      )}

      {confirmando ? (
        <div className="flex flex-col gap-2 rounded-lg border border-marca bg-marca-suave p-3">
          <p className="text-marca-forte">
            A OS será encerrada: os valores ficam fechados e a senha do aparelho é apagada. Confirma a entrega?
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao carregando={pendente} rotuloCarregando="Entregando…" onClick={entregar}>
              Confirmar entrega
            </Botao>
            <Botao variante="discreto" disabled={pendente} onClick={() => setConfirmando(false)}>
              Cancelar
            </Botao>
          </div>
        </div>
      ) : (
        <Botao className="self-start" disabled={pendencias.length > 0 || pendente} onClick={() => setConfirmando(true)}>
          Entregar aparelho
        </Botao>
      )}

      <Retorno msg={msg} />
    </div>
  )
}
