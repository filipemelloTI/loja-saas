import Link from 'next/link'
import type { InputHTMLAttributes, ReactNode } from 'react'

/** Título de uma tela de Configurações, com volta para o índice. */
export function Cabecalho({ titulo, sobre }: { titulo: string; sobre?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Link href="/configuracoes" className="self-start text-sm font-semibold text-marca hover:underline">
        ← Configurações
      </Link>
      <h1 className="font-titulo text-3xl font-bold tracking-tight">{titulo}</h1>
      {sobre && <p className="max-w-prose text-tinta-suave">{sobre}</p>}
    </div>
  )
}

/** Resultado mostrado depois de salvar. */
export type Msg = { ok: boolean; texto: string } | null

export function Carregando() {
  return <p className="text-tinta-suave">Carregando…</p>
}

export const CLASSE_SELECAO = 'min-h-11 w-full rounded-lg border border-linha-forte bg-superficie px-3 text-base text-tinta disabled:bg-superficie-2'

export const CLASSE_TEXTO_LONGO =
  'w-full rounded-lg border border-linha-forte bg-superficie px-3 py-2 text-base text-tinta disabled:bg-superficie-2'

/** Caixa de marcar com rótulo inteiro clicável (alvo de 44px). */
export function Marcar({
  rotulo,
  dica,
  ...resto
}: { rotulo: string; dica?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-superficie-2">
      <input type="checkbox" className="size-5 shrink-0 accent-marca" {...resto} />
      <span>
        {rotulo}
        {dica && <span className="block text-sm text-tinta-suave">{dica}</span>}
      </span>
    </label>
  )
}
