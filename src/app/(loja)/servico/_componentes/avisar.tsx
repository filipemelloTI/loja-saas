'use client'

import { useState } from 'react'
import { Botao, classesBotao } from '@/components/ui/Botao'
import { Rotulo } from '@/components/ui/Campo'
import { EVENTOS, ROTULO_EVENTO, type Evento } from '@/lib/mensagens'
import { linkWhatsApp, preencherMensagem } from '@/lib/whatsapp'

const CAIXA =
  'w-full rounded-lg border border-linha-forte bg-superficie px-3 text-base text-tinta disabled:bg-superficie-2'

/**
 * "Avisar cliente": escolhe o aviso (já vem o da etapa atual), mostra a mensagem pronta para
 * ajustar e abre o WhatsApp da loja com ela. Nada é enviado sem a pessoa apertar enviar lá.
 */
export function AvisarCliente({
  telefone,
  mensagens,
  valores,
  eventoInicial,
  linkAcompanhamento,
}: {
  telefone: string | null
  mensagens: Partial<Record<Evento, string>>
  valores: Record<string, string | null>
  eventoInicial: Evento | null
  linkAcompanhamento: string | null
}) {
  const disponiveis = EVENTOS.filter((e) => e !== 'venda_concluida' && mensagens[e])
  const montar = (e: Evento | '') => (e ? preencherMensagem(mensagens[e] ?? '', valores) : '')
  const [evento, setEvento] = useState<Evento | ''>(eventoInicial && mensagens[eventoInicial] ? eventoInicial : '')
  const [texto, setTexto] = useState(montar(evento))
  const [copiado, setCopiado] = useState<'link' | null>(null)
  const link = linkWhatsApp(telefone, texto)

  async function copiar() {
    if (!linkAcompanhamento) return
    try {
      await navigator.clipboard.writeText(linkAcompanhamento)
      setCopiado('link')
    } catch {
      const campo = document.getElementById('aviso-link') as HTMLInputElement | null
      campo?.select()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Rotulo htmlFor="aviso-evento">Aviso</Rotulo>
        <select
          id="aviso-evento"
          value={evento}
          onChange={(e) => {
            const novo = e.target.value as Evento | ''
            setEvento(novo)
            setTexto(montar(novo))
          }}
          className={`${CAIXA} min-h-11`}
        >
          <option value="">Escolha o aviso</option>
          {disponiveis.map((e) => (
            <option key={e} value={e}>
              {ROTULO_EVENTO[e]}
            </option>
          ))}
        </select>
      </div>

      {evento && (
        <div className="flex flex-col gap-1.5">
          <Rotulo htmlFor="aviso-texto">Mensagem</Rotulo>
          <textarea
            id="aviso-texto"
            rows={4}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className={`${CAIXA} py-2`}
          />
          <p className="text-sm text-tinta-suave">Pode ajustar antes de abrir. O texto padrão fica em Configurações.</p>
        </div>
      )}

      {evento &&
        (link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className={classesBotao('primario', 'self-start')}>
            Abrir no WhatsApp
          </a>
        ) : (
          <p className="rounded-lg bg-sinal-suave px-3 py-2 text-sobre-sinal-suave">
            O telefone do cliente está incompleto. Corrija o cadastro (com DDD) para avisar pelo WhatsApp.
          </p>
        ))}

      {linkAcompanhamento === null ? (
        <p className="border-t border-linha pt-4 text-sm text-tinta-suave">
          O link de acompanhamento do cliente não está disponível agora. As mensagens saem sem ele.
        </p>
      ) : (
      <div className="flex flex-col gap-1.5 border-t border-linha pt-4">
        <Rotulo htmlFor="aviso-link">Link de acompanhamento do cliente</Rotulo>
        <div className="flex flex-wrap gap-2">
          <input
            id="aviso-link"
            readOnly
            value={linkAcompanhamento}
            onFocus={(e) => e.target.select()}
            className={`${CAIXA} min-h-11 min-w-0 flex-1 font-mono text-sm`}
          />
          <Botao variante="secundario" onClick={copiar}>
            {copiado ? 'Copiado' : 'Copiar link'}
          </Botao>
          <a href={linkAcompanhamento} target="_blank" rel="noopener noreferrer" className={classesBotao('discreto')}>
            Ver como o cliente
          </a>
        </div>
      </div>
      )}
    </div>
  )
}
