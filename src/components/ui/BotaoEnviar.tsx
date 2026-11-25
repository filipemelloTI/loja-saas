'use client'

import { useFormStatus } from 'react-dom'
import { Botao, type PropsBotao } from './Botao'

/**
 * Botão de envio para formulários com Server Action (`<form action={…}>`).
 * Descobre sozinho que o envio está em curso — a tela não controla esse estado
 * na mão. Em formulários com `onSubmit` + `useTransition`, use
 * `<Botao carregando={pendente} rotuloCarregando="…">`.
 *
 * Precisa estar DENTRO do `<form>` para enxergar o envio.
 */
export function BotaoEnviar({
  rotuloCarregando = 'Enviando…',
  ...resto
}: Omit<PropsBotao, 'type' | 'carregando'>) {
  const { pending } = useFormStatus()
  return <Botao type="submit" carregando={pending} rotuloCarregando={rotuloCarregando} {...resto} />
}
