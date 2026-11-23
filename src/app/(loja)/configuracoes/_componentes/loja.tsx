'use client'

import { useRef, useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { enviarLogo, salvarDadosLoja } from '../acoes'
import { CLASSE_TEXTO_LONGO, type Msg } from './comum'

const TIPOS = ['image/png', 'image/jpeg', 'image/webp']
const MAXIMO = 1024 * 1024

export function FormularioLogo({ logoUrl, somenteLeitura }: { logoUrl: string | null; somenteLeitura: boolean }) {
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const arquivo = useRef<HTMLInputElement>(null)

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    const f = arquivo.current?.files?.[0]
    // Confere aqui também para não mandar arquivo grande à toa; o servidor confere de novo.
    if (!f) return setMsg({ ok: false, texto: 'Escolha uma imagem' })
    if (!TIPOS.includes(f.type)) return setMsg({ ok: false, texto: 'Use uma imagem PNG, JPG ou WebP' })
    if (f.size > MAXIMO) return setMsg({ ok: false, texto: 'A logo pode ter no máximo 1 MB' })
    const form = new FormData(e.currentTarget)
    iniciar(async () => {
      const r = await enviarLogo(form)
      setMsg(r.ok ? { ok: true, texto: 'Logo atualizada.' } : { ok: false, texto: r.erro })
      if (r.ok && arquivo.current) arquivo.current.value = ''
    })
  }

  return (
    <form onSubmit={enviar}>
      <fieldset disabled={somenteLeitura} className="flex flex-col gap-4">
        <legend className="sr-only">Logo da loja</legend>
        <div className="flex size-28 items-center justify-center overflow-hidden rounded-xl border border-linha bg-superficie-2">
          {logoUrl ? (
            // URL assinada e temporária: o otimizador de imagens não ajuda aqui.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo atual da loja" className="size-full object-contain" />
          ) : (
            <span className="px-2 text-center text-sm text-tinta-suave">Sem logo</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="campo-logo" className="text-sm font-semibold text-tinta">
            Nova logo
          </label>
          <input
            ref={arquivo}
            id="campo-logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-describedby="campo-logo-dica"
            className="min-h-11 max-w-full text-base text-tinta file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-linha-forte file:bg-superficie file:px-4 file:font-semibold file:text-tinta"
          />
          <p id="campo-logo-dica" className="text-sm text-tinta-suave">
            PNG, JPG ou WebP, até 1 MB.
          </p>
        </div>
        <Retorno msg={msg} />
        <div>
          <Botao type="submit" variante="secundario" disabled={pendente}>
            {pendente ? 'Enviando…' : 'Enviar logo'}
          </Botao>
        </div>
      </fieldset>
    </form>
  )
}

type Dados = { nome: string; cnpj: string; endereco: string; telefone: string; textoTermos: string }

export function FormularioDadosLoja({ inicial, somenteLeitura }: { inicial: Dados; somenteLeitura: boolean }) {
  const [dados, setDados] = useState(inicial)
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const campo = (k: keyof Dados) => ({
    value: dados[k],
    onChange: (e: { target: { value: string } }) => setDados({ ...dados, [k]: e.target.value }),
  })

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    iniciar(async () => {
      const r = await salvarDadosLoja(dados)
      setMsg(r.ok ? { ok: true, texto: 'Dados salvos.' } : { ok: false, texto: r.erro })
    })
  }

  return (
    <form onSubmit={enviar}>
      <fieldset disabled={somenteLeitura} className="flex flex-col gap-5">
        <legend className="sr-only">Dados da loja</legend>
        <Cartao titulo="Identificação">
          <div className="flex flex-col gap-4">
            <Campo name="nome" rotulo="Nome da loja" required maxLength={80} {...campo('nome')} />
            <Campo name="cnpj" rotulo="CNPJ" inputMode="numeric" maxLength={20} {...campo('cnpj')} />
            <Campo name="endereco" rotulo="Endereço" maxLength={200} autoComplete="street-address" {...campo('endereco')} />
            <Campo
              name="telefone"
              rotulo="Telefone / WhatsApp"
              type="tel"
              inputMode="tel"
              maxLength={20}
              dica="Com DDD. É o número que aparece para o cliente."
              {...campo('telefone')}
            />
          </div>
        </Cartao>
        <Cartao titulo="Termos">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="campo-termos" className="text-sm font-semibold text-tinta">
              Texto dos termos
            </label>
            <textarea
              id="campo-termos"
              name="textoTermos"
              rows={8}
              maxLength={5000}
              aria-describedby="campo-termos-dica"
              className={CLASSE_TEXTO_LONGO}
              {...campo('textoTermos')}
            />
            <p id="campo-termos-dica" className="text-sm text-tinta-suave">
              Vai impresso na OS e no termo de garantia.
            </p>
          </div>
        </Cartao>
        <Retorno msg={msg} />
        <div>
          <Botao type="submit" disabled={pendente}>
            {pendente ? 'Salvando…' : 'Salvar dados'}
          </Botao>
        </div>
      </fieldset>
    </form>
  )
}
