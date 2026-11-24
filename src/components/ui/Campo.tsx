import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  name: string
  rotulo: string
  /** Mensagem de erro; quando presente, o campo fica marcado como inválido. */
  erro?: string
  /** Texto de ajuda curto abaixo do campo. */
  dica?: string
}

export function Campo({ name, rotulo, erro, dica, id, className = '', ...resto }: Props) {
  const idCampo = id ?? `campo-${name}`
  const idDica = dica ? `${idCampo}-dica` : undefined
  const idErro = erro ? `${idCampo}-erro` : undefined
  const descritoPor = [idDica, idErro].filter(Boolean).join(' ') || undefined

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <label htmlFor={idCampo} className="text-sm font-semibold text-tinta">
        {rotulo}
      </label>
      <input
        id={idCampo}
        name={name}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descritoPor}
        className={
          'min-h-11 w-full rounded-lg border bg-superficie px-3 text-base text-tinta ' +
          'placeholder:text-tinta-suave disabled:bg-superficie-2 ' +
          (erro ? 'border-perigo' : 'border-linha-forte')
        }
        {...resto}
      />
      {dica && (
        <p id={idDica} className="text-sm text-tinta-suave">
          {dica}
        </p>
      )}
      {erro && (
        <p id={idErro} className="text-sm font-medium text-perigo">
          {erro}
        </p>
      )}
    </div>
  )
}
