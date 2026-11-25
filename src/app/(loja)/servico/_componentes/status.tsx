'use client'

import { useState, useTransition } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo, Rotulo } from '@/components/ui/Campo'
import { ROTULO_STATUS, type StatusOS } from '@/lib/os-status'
import { mudarStatusOS } from '../acoes'

type Msg = { ok: boolean; texto: string } | null

const CAIXA = 'min-h-11 w-full rounded-lg border border-linha-forte bg-superficie px-3 text-base text-tinta disabled:bg-superficie-2'

/**
 * Botões das etapas. `avancos` vem de `avancosDe` e `voltas` das etapas que `podeMudar` libera sem serem
 * avanço (só o Dono as recebe, a página já filtrou). O servidor confere tudo de novo.
 */
export function AcoesStatus({
  osId,
  avancos,
  voltas,
  somenteLeitura,
}: {
  osId: string
  avancos: StatusOS[]
  voltas: StatusOS[]
  somenteLeitura: boolean
}) {
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [alvo, setAlvo] = useState<StatusOS | null>(null)
  const [observacao, setObservacao] = useState('')
  const [voltarPara, setVoltarPara] = useState('')

  function mudar(para: StatusOS) {
    setMsg(null)
    setAlvo(para)
    iniciar(async () => {
      try {
        const r = await mudarStatusOS(osId, para, observacao)
        if (!r.ok) return setMsg({ ok: false, texto: r.erro })
        setObservacao('')
        setVoltarPara('')
        setMsg({ ok: true, texto: `Etapa alterada para “${ROTULO_STATUS[para].rotulo}”.` })
      } catch {
        setMsg({ ok: false, texto: 'Não foi possível mudar a etapa agora. Confira sua conexão e tente de novo.' })
      }
    })
  }

  return (
    <fieldset disabled={somenteLeitura} className="flex flex-col gap-4">
      <legend className="sr-only">Mudar a etapa da OS</legend>
      <Campo
        id="os-obs-etapa"
        name="observacaoEtapa"
        rotulo="Observação da mudança"
        opcional
        autoComplete="off"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        dica="Aparece no histórico, junto com a mudança."
      />

      <div className="flex flex-wrap gap-2">
        {avancos.map((s, i) => (
          <Botao
            key={s}
            variante={s === 'recusado' ? 'perigo' : i === 0 ? 'primario' : 'secundario'}
            disabled={pendente}
            carregando={pendente && alvo === s}
            rotuloCarregando="Mudando…"
            onClick={() => mudar(s)}
          >
            {ROTULO_STATUS[s].rotulo}
          </Botao>
        ))}
      </div>

      {voltas.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-linha pt-4">
          <Rotulo htmlFor="os-voltar">Voltar para uma etapa anterior</Rotulo>
          <p className="text-sm text-tinta-suave">Só o Dono pode voltar. Use quando a etapa foi marcada por engano.</p>
          <div className="flex flex-wrap items-end gap-2">
            <select
              id="os-voltar"
              value={voltarPara}
              onChange={(e) => setVoltarPara(e.target.value)}
              className={`${CAIXA} sm:max-w-xs`}
            >
              <option value="">Escolha a etapa</option>
              {voltas.map((s) => (
                <option key={s} value={s}>
                  {ROTULO_STATUS[s].rotulo}
                </option>
              ))}
            </select>
            <Botao
              variante="secundario"
              disabled={!voltarPara || pendente}
              carregando={pendente && alvo === voltarPara}
              rotuloCarregando="Voltando…"
              onClick={() => mudar(voltarPara as StatusOS)}
            >
              Voltar etapa
            </Botao>
          </div>
        </div>
      )}

      <Retorno msg={msg} />
    </fieldset>
  )
}
