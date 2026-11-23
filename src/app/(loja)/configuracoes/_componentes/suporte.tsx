'use client'

import { useState, useTransition } from 'react'
import { Alerta, Aviso } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Cartao } from '@/components/ui/Cartao'
import { Selo } from '@/components/ui/Selo'
import { HORAS_SUPORTE } from '@/lib/configuracoes'
import { encerrarSuporte, liberarSuporte } from '../acoes'

function rotuloDuracao(horas: number) {
  if (horas % 24 !== 0) return `${horas} horas`
  const dias = horas / 24
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

/**
 * Painel do Dono para o acesso de suporte: libera por um tempo limitado ou encerra agora.
 * O admin em suporte vê como Dono, mas `somenteLeitura` desliga os botões (a RLS também barra).
 */
export function PainelSuporte({
  vigente,
  expiraEmTexto,
  somenteLeitura,
}: {
  vigente: boolean
  expiraEmTexto: string | null
  somenteLeitura: boolean
}) {
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [pendente, iniciar] = useTransition()

  function liberar(horas: number) {
    setMsg(null)
    setConfirmar(false)
    iniciar(async () => {
      const r = await liberarSuporte(horas)
      setMsg(r.ok ? { ok: true, texto: 'Acesso de suporte liberado.' } : { ok: false, texto: r.erro })
    })
  }

  function encerrar() {
    setConfirmar(false)
    setMsg(null)
    iniciar(async () => {
      const r = await encerrarSuporte()
      setMsg(r.ok ? { ok: true, texto: 'Acesso de suporte encerrado.' } : { ok: false, texto: r.erro })
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <Cartao titulo="Situação">
        {vigente ? (
          <div className="flex flex-col gap-2">
            <div>
              <Selo tom="info">Acesso liberado</Selo>
            </div>
            <p className="text-tinta-suave">
              O suporte pode entrar na sua loja em modo somente leitura
              {expiraEmTexto ? ` até ${expiraEmTexto}` : ''}. Ele não altera nada.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div>
              <Selo tom="neutro">Sem acesso</Selo>
            </div>
            <p className="text-tinta-suave">O suporte não consegue entrar na sua loja no momento.</p>
          </div>
        )}
      </Cartao>

      {somenteLeitura ? (
        <p className="text-tinta-suave">Em modo suporte você não altera o acesso.</p>
      ) : (
        <Cartao titulo={vigente ? 'Renovar ou encerrar' : 'Liberar acesso'}>
          <div className="flex flex-col gap-4">
            <p className="text-tinta-suave">
              {vigente
                ? 'Liberar de novo renova o prazo a partir de agora. Encerrar corta o acesso na hora.'
                : 'Escolha por quanto tempo o suporte pode entrar. Você pode encerrar antes a qualquer momento.'}
            </p>
            {msg && (msg.ok ? <Aviso>{msg.texto}</Aviso> : <Alerta>{msg.texto}</Alerta>)}
            <div className="flex flex-wrap gap-2">
              {HORAS_SUPORTE.map((h) => (
                <Botao key={h} variante="primario" onClick={() => liberar(h)} disabled={pendente}>
                  {pendente ? 'Aguarde…' : `Liberar por ${rotuloDuracao(h)}`}
                </Botao>
              ))}
            </div>
            {vigente &&
              (confirmar ? (
                <div
                  role="alertdialog"
                  aria-labelledby="encerrar-suporte-titulo"
                  className="flex flex-col gap-3 rounded-xl border border-perigo bg-perigo-suave p-4"
                >
                  <p id="encerrar-suporte-titulo" className="font-semibold text-sobre-perigo-suave">
                    Encerrar o acesso de suporte agora? O suporte perde o acesso à sua loja na próxima navegação.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Botao variante="perigo" onClick={encerrar} disabled={pendente}>
                      Sim, encerrar
                    </Botao>
                    <Botao variante="secundario" onClick={() => setConfirmar(false)}>
                      Cancelar
                    </Botao>
                  </div>
                </div>
              ) : (
                <div>
                  <Botao variante="perigo" onClick={() => setConfirmar(true)} disabled={pendente}>
                    Encerrar acesso agora
                  </Botao>
                </div>
              ))}
          </div>
        </Cartao>
      )}
    </div>
  )
}
