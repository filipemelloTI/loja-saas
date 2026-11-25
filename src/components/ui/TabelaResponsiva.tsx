import type { ReactNode } from 'react'

export type Coluna<T> = {
  titulo: string
  valor: (linha: T) => ReactNode
  /** Números e dinheiro alinham à direita. */
  alinhar?: 'esquerda' | 'direita'
}

type Props<T> = {
  /** Descreve a tabela para leitores de tela. */
  legenda: string
  colunas: Coluna<T>[]
  linhas: T[]
  chave: (linha: T) => string
  /** Texto quando não há linhas: diga o que fazer a seguir. */
  vazio: ReactNode
}

/**
 * Celular: uma lista de cartões, a primeira coluna vira o título do cartão.
 * Computador (≥ 1024px): tabela normal, com cabeçalho fixo ao rolar.
 *
 * Os rótulos (cabeçalho da tabela e nome do campo no cartão) usam a
 * "sobrancelha" — mono, caixa-alta, espaçada — para separarem do dado sem
 * competir com ele.
 */
export function TabelaResponsiva<T>({ legenda, colunas, linhas, chave, vazio }: Props<T>) {
  if (linhas.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-linha-forte p-6 text-tinta-suave">{vazio}</p>
    )
  }
  const [principal, ...demais] = colunas
  const direita = (c: Coluna<T>) => (c.alinhar === 'direita' ? 'text-right numeros' : 'text-left')

  return (
    <>
      <ul aria-label={legenda} className="flex flex-col gap-2 lg:hidden">
        {linhas.map((linha) => (
          <li key={chave(linha)} className="realce rounded-xl border border-linha bg-superficie p-4">
            <div className="font-titulo font-semibold text-tinta">{principal.valor(linha)}</div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
              {demais.map((c) => (
                <div key={c.titulo} className="contents">
                  <dt className="sobrancelha">{c.titulo}</dt>
                  <dd className={`text-tinta ${c.alinhar === 'direita' ? 'numeros' : ''}`}>
                    {c.valor(linha)}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="realce hidden overflow-hidden rounded-xl border border-linha bg-superficie lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            <tr className="border-b border-linha bg-superficie-2">
              {colunas.map((c) => (
                <th
                  key={c.titulo}
                  scope="col"
                  className={`sobrancelha px-4 py-3 ${c.alinhar === 'direita' ? 'text-right' : 'text-left'}`}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr
                key={chave(linha)}
                className="border-b border-linha transition-colors last:border-b-0 hover:bg-marca-suave/40"
              >
                {colunas.map((c) => (
                  <td key={c.titulo} className={`px-4 py-3 text-tinta ${direita(c)}`}>
                    {c.valor(linha)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
