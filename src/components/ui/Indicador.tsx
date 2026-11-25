import Link from 'next/link'
import type { ReactNode } from 'react'

export type TomIndicador = 'neutro' | 'marca' | 'aviso' | 'perigo'

const BORDAS: Record<TomIndicador, string> = {
  neutro: 'border-linha',
  marca: 'border-marca/45',
  aviso: 'border-sinal/50',
  perigo: 'border-perigo/45',
}

const VALORES: Record<TomIndicador, string> = {
  neutro: 'text-tinta',
  marca: 'text-marca',
  aviso: 'text-sobre-sinal-suave',
  perigo: 'text-perigo',
}

type Props = {
  /** O que o número é. Vai em mono caixa-alta, acima do valor. */
  rotulo: string
  /** O número em si. Já formatado (ex.: "R$ 1.240,00", "12"). */
  valor: ReactNode
  /** Linha curta embaixo: comparação, prazo, contexto. */
  detalhe?: string
  tom?: TomIndicador
  /** Quando existe, o indicador inteiro vira link para a lista que ele resume. */
  href?: string
}

/**
 * Número que vale uma olhada: aparelhos prontos, estoque acabando, venda do dia.
 * O valor usa a fonte de título tabular (`.numeros`) — lê como painel, e colunas
 * de indicadores alinham.
 */
export function Indicador({ rotulo, valor, detalhe, tom = 'neutro', href }: Props) {
  const conteudo = (
    <>
      <p className="sobrancelha">{rotulo}</p>
      <p className={`numeros text-2xl font-bold leading-none ${VALORES[tom]}`}>{valor}</p>
      {detalhe && <p className="font-mono text-xs text-tinta-suave">{detalhe}</p>}
    </>
  )

  const classes =
    `realce flex min-w-0 flex-col gap-2 rounded-xl border bg-superficie p-4 ${BORDAS[tom]}`.trim()

  if (href) {
    return (
      <Link href={href} className={`${classes} transition-colors hover:border-marca hover:bg-marca-suave`}>
        {conteudo}
      </Link>
    )
  }
  return <div className={classes}>{conteudo}</div>
}

/** Fileira de indicadores. Quebra para 2 colunas no celular. */
export function Indicadores({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
}
