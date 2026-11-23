import type { ReactNode } from 'react'

/** Erro de uma ação, anunciado ao leitor de tela. */
export function Alerta({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-perigo-suave px-3 py-2 font-medium text-sobre-perigo-suave">
      {children}
    </p>
  )
}

/** Confirmação de uma ação ("Alterações salvas."). */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg bg-marca-suave px-3 py-2 font-medium text-marca-forte">
      {children}
    </p>
  )
}

/** Resultado de uma ação: verde se deu certo, vermelho se não. */
export function Retorno({ msg }: { msg: { ok: boolean; texto: string } | null }) {
  if (!msg) return null
  return msg.ok ? <Aviso>{msg.texto}</Aviso> : <Alerta>{msg.texto}</Alerta>
}
