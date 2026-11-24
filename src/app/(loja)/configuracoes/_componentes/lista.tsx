'use client'

/** Move o item `i` uma posição para cima (-1) ou para baixo (+1). */
export function mover<T>(lista: T[], i: number, passo: -1 | 1): T[] {
  const j = i + passo
  if (j < 0 || j >= lista.length) return lista
  const nova = [...lista]
  ;[nova[i], nova[j]] = [nova[j], nova[i]]
  return nova
}

/** Chave estável para itens novos (ainda sem id do banco). */
let contador = 0
export const novaChave = () => `novo-${++contador}`

/** Botões Subir/Descer de um item da lista (reordenar sem arrastar). */
export function BotoesOrdem({
  nome,
  primeiro,
  ultimo,
  aoMover,
}: {
  nome: string
  primeiro: boolean
  ultimo: boolean
  aoMover: (passo: -1 | 1) => void
}) {
  const classe =
    'flex size-11 items-center justify-center rounded-lg text-tinta-suave hover:bg-superficie-2 hover:text-tinta disabled:opacity-30'
  return (
    <div className="flex shrink-0">
      <button type="button" className={classe} disabled={primeiro} onClick={() => aoMover(-1)} aria-label={`Subir ${nome}`}>
        <Seta para="cima" />
      </button>
      <button type="button" className={classe} disabled={ultimo} onClick={() => aoMover(1)} aria-label={`Descer ${nome}`}>
        <Seta para="baixo" />
      </button>
    </div>
  )
}

function Seta({ para }: { para: 'cima' | 'baixo' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
      <path d={para === 'cima' ? 'M12 19V5M5 12l7-7 7 7' : 'M12 5v14M5 12l7 7 7-7'} />
    </svg>
  )
}
