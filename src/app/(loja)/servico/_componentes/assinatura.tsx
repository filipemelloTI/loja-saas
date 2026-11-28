'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import type { MomentoAssinatura } from '@/lib/assinatura'
import { salvarAssinatura } from '../acoes'

type Msg = { ok: boolean; texto: string } | null

const TITULO: Record<MomentoAssinatura, string> = { entrada: 'Na entrada', entrega: 'Na entrega' }

/** Quadro para o cliente assinar com o dedo (ou o mouse). Desenho em preto sobre branco, salvo como PNG. */
function Quadro({ aoSalvar, pendente }: { aoSalvar: (png: Blob) => void; pendente: boolean }) {
  const tela = useRef<HTMLCanvasElement>(null)
  const desenhando = useRef(false)
  const [vazio, setVazio] = useState(true)

  useEffect(() => {
    const c = tela.current
    if (!c) return
    const escala = window.devicePixelRatio || 1
    c.width = c.clientWidth * escala
    c.height = c.clientHeight * escala
    const g = c.getContext('2d')
    if (!g) return
    g.scale(escala, escala)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, c.width, c.height)
    g.lineWidth = 2.5
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = '#111111'
  }, [])

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function limpar() {
    const c = tela.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, c.width, c.height)
    g.restore()
    setVazio(true)
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={tela}
        aria-label="Quadro de assinatura: assine com o dedo"
        className="h-40 w-full touch-none rounded-lg border border-linha-forte bg-folha"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          desenhando.current = true
          const g = e.currentTarget.getContext('2d')
          const p = ponto(e)
          g?.beginPath()
          g?.moveTo(p.x, p.y)
        }}
        onPointerMove={(e) => {
          if (!desenhando.current) return
          const g = e.currentTarget.getContext('2d')
          const p = ponto(e)
          g?.lineTo(p.x, p.y)
          g?.stroke()
          setVazio(false)
        }}
        onPointerUp={() => {
          desenhando.current = false
        }}
        onPointerCancel={() => {
          desenhando.current = false
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Botao
          disabled={vazio}
          carregando={pendente}
          rotuloCarregando="Salvando…"
          onClick={() => tela.current?.toBlob((b) => b && aoSalvar(b), 'image/png')}
        >
          Salvar assinatura
        </Botao>
        <Botao variante="discreto" disabled={pendente || vazio} onClick={limpar}>
          Limpar
        </Botao>
      </div>
    </div>
  )
}

export function AssinaturaDoCliente({
  osId,
  momento,
  atual,
  pode,
}: {
  osId: string
  momento: MomentoAssinatura
  /** Endereço da assinatura já salva, se houver. */
  atual: string | null
  /** Se a OS ainda aceita assinatura neste momento. */
  pode: boolean
}) {
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [refazendo, setRefazendo] = useState(false)

  function salvar(png: Blob) {
    setMsg(null)
    iniciar(async () => {
      const form = new FormData()
      form.set('osId', osId)
      form.set('momento', momento)
      form.set('assinatura', new File([png], 'assinatura.png', { type: 'image/png' }))
      try {
        const r = await salvarAssinatura(form)
        if (!r.ok) return setMsg({ ok: false, texto: r.erro })
        setRefazendo(false)
        setMsg({ ok: true, texto: 'Assinatura salva.' })
      } catch {
        setMsg({ ok: false, texto: 'Não foi possível salvar agora. Confira sua conexão e tente de novo.' })
      }
    })
  }

  return (
    <section aria-label={`Assinatura ${TITULO[momento].toLowerCase()}`} className="flex flex-col gap-2">
      <p className="sobrancelha">{TITULO[momento]}</p>
      {atual && !refazendo ? (
        <div className="flex flex-wrap items-end gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária */}
          <img src={atual} alt={`Assinatura do cliente ${TITULO[momento].toLowerCase()}`} className="h-20 rounded-lg border border-linha bg-folha" />
          {pode && (
            <Botao variante="discreto" onClick={() => setRefazendo(true)}>
              Refazer
            </Botao>
          )}
        </div>
      ) : pode ? (
        <Quadro aoSalvar={salvar} pendente={pendente} />
      ) : (
        <p className="text-sm text-tinta-suave">Sem assinatura.</p>
      )}
      <Retorno msg={msg} />
    </section>
  )
}
