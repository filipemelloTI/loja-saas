import type { InputHTMLAttributes, ReactNode } from 'react'

/**
 * Rótulo padrão de campo, com a marcação de obrigatório/opcional.
 *
 * Regra da casa: marque o que é **exceção** no formulário. Se quase tudo é
 * obrigatório, marque os opcionais (`opcional`); se quase tudo é opcional,
 * marque os obrigatórios (`obrigatorio`). Marcar tudo vira ruído e não informa.
 *
 * O asterisco é só visual (`aria-hidden`): quem usa leitor de tela já ouve
 * "obrigatório" do próprio `required` do campo.
 */
export function Rotulo({
  htmlFor,
  children,
  obrigatorio = false,
  opcional = false,
}: {
  htmlFor?: string
  children: ReactNode
  obrigatorio?: boolean
  opcional?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-tinta">
      {children}
      {obrigatorio && (
        <span className="ml-0.5 text-perigo" aria-hidden="true">
          *
        </span>
      )}
      {opcional && <span className="ml-1.5 font-normal text-tinta-suave">(opcional)</span>}
    </label>
  )
}

/**
 * Nota para formulário em que **todo** campo é obrigatório. Dizer isso uma vez
 * informa melhor do que repetir `*` em cada rótulo (que vira ruído e não
 * distingue nada).
 */
export function TodosObrigatorios() {
  return <p className="text-sm text-tinta-suave">Todos os campos são obrigatórios.</p>
}

type Props = InputHTMLAttributes<HTMLInputElement> & {
  name: string
  rotulo: string
  /** Mensagem de erro; quando presente, o campo fica marcado como inválido. */
  erro?: string
  /** Texto de ajuda curto abaixo do campo. */
  dica?: string
  /** Escreve "(opcional)" no rótulo. Use quando o formulário é quase todo obrigatório. */
  opcional?: boolean
  /**
   * Mostra o `*` de obrigatório. É opt-in de propósito: num formulário em que
   * quase tudo é obrigatório, marcar tudo não informa nada (use
   * `<TodosObrigatorios />`). Marque só quando o obrigatório for a exceção.
   */
  marcarObrigatorio?: boolean
}

export function Campo({
  name,
  rotulo,
  erro,
  dica,
  opcional = false,
  marcarObrigatorio,
  id,
  className = '',
  required,
  ...resto
}: Props) {
  const idCampo = id ?? `campo-${name}`
  const idDica = dica ? `${idCampo}-dica` : undefined
  const idErro = erro ? `${idCampo}-erro` : undefined
  const descritoPor = [idDica, idErro].filter(Boolean).join(' ') || undefined
  const mostrarAsterisco = (marcarObrigatorio ?? false) && !opcional

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <Rotulo htmlFor={idCampo} obrigatorio={mostrarAsterisco} opcional={opcional}>
        {rotulo}
      </Rotulo>
      <input
        id={idCampo}
        name={name}
        required={required}
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
