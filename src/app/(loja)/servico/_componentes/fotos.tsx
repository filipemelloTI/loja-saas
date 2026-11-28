'use client'

import { useRef, useState, useTransition } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { dimensionar, MOMENTOS, ROTULO_MOMENTO, type Foto, type Momento } from '@/lib/fotos'
import { enviarFoto, removerFoto } from '../acoes'

type Msg = { ok: boolean; texto: string } | null

/** Reduz no próprio celular antes de enviar: foto de 4 MB vira umas centenas de KB. */
async function reduzir(arquivo: File): Promise<File> {
  const imagem = await createImageBitmap(arquivo)
  const { largura, altura } = dimensionar(imagem.width, imagem.height)
  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura
  tela.getContext('2d')?.drawImage(imagem, 0, 0, largura, altura)
  imagem.close()
  const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, 'image/jpeg', 0.8))
  if (!blob) throw new Error('sem imagem')
  return new File([blob], 'foto.jpg', { type: 'image/jpeg' })
}

export function FotosDaOS({
  osId,
  fotos,
  podeApagar,
  bloqueado,
}: {
  osId: string
  fotos: Foto[]
  /** Falso depois que a OS foi encerrada. */
  podeApagar: boolean
  /** Modo suporte. */
  bloqueado: boolean
}) {
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [progresso, setProgresso] = useState<string | null>(null)
  const entradas = useRef<Partial<Record<Momento, HTMLInputElement | null>>>({})

  function enviar(momento: Momento, arquivos: FileList | null) {
    if (!arquivos?.length) return
    const lista = [...arquivos]
    setMsg(null)
    iniciar(async () => {
      let enviadas = 0
      for (const [i, arquivo] of lista.entries()) {
        setProgresso(`Enviando ${i + 1} de ${lista.length}…`)
        let reduzida: File
        try {
          reduzida = await reduzir(arquivo)
        } catch {
          setMsg({ ok: false, texto: 'Não deu para abrir essa foto. Tire de novo pela câmera ou use JPG ou PNG.' })
          break
        }
        const form = new FormData()
        form.set('osId', osId)
        form.set('momento', momento)
        form.set('foto', reduzida)
        try {
          const r = await enviarFoto(form)
          if (!r.ok) {
            setMsg({ ok: false, texto: r.erro })
            break
          }
          enviadas++
        } catch {
          setMsg({ ok: false, texto: 'Não foi possível enviar agora. Confira sua conexão e tente de novo.' })
          break
        }
      }
      setProgresso(null)
      if (enviadas) setMsg((m) => m ?? { ok: true, texto: enviadas === 1 ? 'Foto enviada.' : `${enviadas} fotos enviadas.` })
      const campo = entradas.current[momento]
      if (campo) campo.value = ''
    })
  }

  function apagar(id: string) {
    setMsg(null)
    iniciar(async () => {
      try {
        const r = await removerFoto(id)
        setMsg(r.ok ? { ok: true, texto: 'Foto apagada.' } : { ok: false, texto: r.erro })
      } catch {
        setMsg({ ok: false, texto: 'Não foi possível apagar agora. Tente de novo.' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {MOMENTOS.map((momento) => {
        const doMomento = fotos.filter((f) => f.momento === momento)
        return (
          <section key={momento} aria-label={`Fotos ${ROTULO_MOMENTO[momento].toLowerCase()}`} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="sobrancelha">
                {ROTULO_MOMENTO[momento]} <span className="numeros">({doMomento.length}/8)</span>
              </p>
              {!bloqueado && doMomento.length < 8 && (
                <>
                  <input
                    ref={(el) => {
                      entradas.current[momento] = el
                    }}
                    id={`foto-${momento}`}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="sr-only"
                    onChange={(e) => enviar(momento, e.target.files)}
                  />
                  <Botao variante="secundario" disabled={pendente} onClick={() => entradas.current[momento]?.click()}>
                    Tirar ou escolher foto
                  </Botao>
                </>
              )}
            </div>
            {doMomento.length === 0 ? (
              <p className="text-sm text-tinta-suave">Nenhuma foto ainda.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {doMomento.map((f) => (
                  <li key={f.id} className="flex flex-col gap-1">
                    {f.url ? (
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-linha">
                        {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária */}
                        <img src={f.url} alt={`Foto ${ROTULO_MOMENTO[momento].toLowerCase()}`} className="aspect-square w-full object-cover" />
                      </a>
                    ) : (
                      <div className="aspect-square rounded-lg border border-linha bg-superficie-2" />
                    )}
                    {podeApagar && !bloqueado && (
                      <Botao variante="discreto" className="text-sm" disabled={pendente} onClick={() => apagar(f.id)}>
                        Apagar
                      </Botao>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
      {progresso && (
        <p role="status" className="text-sm text-tinta-suave">
          {progresso}
        </p>
      )}
      <Retorno msg={msg} />
    </div>
  )
}
