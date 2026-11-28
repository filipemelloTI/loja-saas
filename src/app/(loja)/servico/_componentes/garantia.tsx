'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Retorno } from '@/components/ui/Avisos'
import { Botao, classesBotao } from '@/components/ui/Botao'
import { Campo, Rotulo } from '@/components/ui/Campo'
import { Selo, type TomSelo } from '@/components/ui/Selo'
import { formatarDataISO } from '@/lib/formatar'
import { ROTULO_SITUACAO, situacaoGarantia, type Situacao } from '@/lib/garantia'
import { abrirGarantia, ajustarGarantia } from '../acoes'

type Msg = { ok: boolean; texto: string } | null

const TOM: Record<Situacao, TomSelo> = { vigente: 'info', vencendo: 'aviso', vencida: 'neutro' }

export function GarantiaDaOS({
  osId,
  encerrada,
  encerradaEm,
  garantiaDias,
  garantiaAjusteDias,
  prevista,
  podeAjustar,
  bloqueado,
}: {
  osId: string
  encerrada: boolean
  encerradaEm: string | null
  garantiaDias: number | null
  garantiaAjusteDias: number | null
  prevista: number | null
  /** Dono, fora do modo suporte. */
  podeAjustar: boolean
  bloqueado: boolean
}) {
  const router = useRouter()
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [dias, setDias] = useState(garantiaAjusteDias === null ? '' : String(garantiaAjusteDias))
  const [defeito, setDefeito] = useState('')
  const [abrindo, setAbrindo] = useState(false)

  function salvarAjuste(valor: number | null, sucesso: string) {
    setMsg(null)
    iniciar(async () => {
      try {
        const r = await ajustarGarantia(osId, valor)
        setMsg(r.ok ? { ok: true, texto: sucesso } : { ok: false, texto: r.erro })
      } catch {
        setMsg({ ok: false, texto: 'Não foi possível salvar agora. Confira sua conexão e tente de novo.' })
      }
    })
  }

  function ajustar(e: FormEvent) {
    e.preventDefault()
    const n = Number(dias)
    if (dias.trim() === '' || !Number.isInteger(n) || n < 0) return setMsg({ ok: false, texto: 'Informe o prazo em dias.' })
    salvarAjuste(n, 'Prazo de garantia ajustado.')
  }

  function abrir(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    iniciar(async () => {
      try {
        const r = await abrirGarantia(osId, defeito)
        if (!r.ok) return setMsg({ ok: false, texto: r.erro })
        router.push(`/servico/${r.id}`)
      } catch {
        setMsg({ ok: false, texto: 'Não foi possível abrir agora. Confira sua conexão e tente de novo.' })
      }
    })
  }

  // Antes da entrega: o prazo que a OS vai ter.
  if (!encerrada) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-tinta">
          {prevista === null ? (
            'O prazo é definido na entrega.'
          ) : (
            <>
              <span className="numeros font-semibold">{prevista}</span> dias a partir da entrega
              {garantiaAjusteDias !== null ? ' (ajustado pelo Dono).' : '.'}
            </>
          )}
        </p>
        {podeAjustar && !bloqueado && (
          <form onSubmit={ajustar} className="flex flex-wrap items-end gap-2">
            <Campo
              id="garantia-dias"
              name="dias"
              rotulo="Ajustar prazo (dias)"
              type="number"
              inputMode="numeric"
              min={0}
              max={3650}
              className="w-40"
              value={dias}
              onChange={(e) => setDias(e.target.value)}
            />
            <Botao type="submit" variante="secundario" carregando={pendente} rotuloCarregando="Salvando…">
              Salvar prazo
            </Botao>
            {garantiaAjusteDias !== null && (
              <Botao
                variante="discreto"
                disabled={pendente}
                onClick={() => {
                  setDias('')
                  salvarAjuste(null, 'Prazo volta a seguir o catálogo e o padrão da loja.')
                }}
              >
                Voltar ao automático
              </Botao>
            )}
          </form>
        )}
        <Retorno msg={msg} />
      </div>
    )
  }

  if (garantiaDias === null || !encerradaEm) {
    return <p className="text-tinta-suave">Esta OS não tem garantia.</p>
  }

  const s = situacaoGarantia(encerradaEm, garantiaDias)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Selo tom={TOM[s.situacao]}>{ROTULO_SITUACAO[s.situacao]}</Selo>
        <span className="text-tinta">
          <span className="numeros">{garantiaDias}</span> dias, até{' '}
          <span className="numeros font-semibold">{formatarDataISO(s.venceEm)}</span>
          {s.situacao !== 'vencida' && (
            <span className="text-tinta-suave">
              {' '}
              · {s.diasRestantes === 0 ? 'vence hoje' : `faltam ${s.diasRestantes} ${s.diasRestantes === 1 ? 'dia' : 'dias'}`}
            </span>
          )}
        </span>
      </div>

      <Link href={`/servico/${osId}/termo`} className={classesBotao('secundario', 'self-start')}>
        Termo de garantia
      </Link>

      {s.situacao !== 'vencida' && !bloqueado && (
        <div className="flex flex-col gap-3 border-t border-linha pt-4">
          {abrindo ? (
            <form onSubmit={abrir} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Rotulo htmlFor="garantia-defeito">O que voltou a acontecer</Rotulo>
                <textarea
                  id="garantia-defeito"
                  required
                  rows={3}
                  value={defeito}
                  onChange={(e) => setDefeito(e.target.value)}
                  className="w-full rounded-lg border border-linha-forte bg-superficie px-3 py-2 text-base text-tinta"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Botao type="submit" carregando={pendente} rotuloCarregando="Abrindo…">
                  Abrir OS de garantia
                </Botao>
                <Botao variante="discreto" disabled={pendente} onClick={() => setAbrindo(false)}>
                  Cancelar
                </Botao>
              </div>
            </form>
          ) : (
            <Botao variante="discreto" className="self-start" onClick={() => setAbrindo(true)}>
              O aparelho voltou com o mesmo problema
            </Botao>
          )}
        </div>
      )}

      <Retorno msg={msg} />
    </div>
  )
}
