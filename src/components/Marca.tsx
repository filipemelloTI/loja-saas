import { DESCRICAO_SISTEMA, NOME_SISTEMA } from '@/lib/marca'

/**
 * Assinatura do produto nas telas de entrada (login, definir senha).
 * Dentro do app a marca já vive no topo/trilho, então não se repete aqui.
 */
export function Marca({ comDescricao = false }: { comDescricao?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-titulo text-3xl font-bold tracking-tight text-marca">{NOME_SISTEMA}</p>
      {comDescricao && <p className="text-pretty text-sm text-tinta-suave">{DESCRICAO_SISTEMA}</p>}
    </div>
  )
}
