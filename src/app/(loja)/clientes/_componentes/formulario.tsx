'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { formatarCpf, formatarTelefone } from '@/lib/formatar'
import type { Cliente } from '@/lib/clientes'
import { salvarCliente } from '../acoes'

type Msg = { ok: boolean; texto: string } | null

/**
 * Cadastro e edição de cliente. Só nome e telefone são obrigatórios, então (DESIGN.md §6.2)
 * marca-se o obrigatório com `*`. Telefone e CPF vão como o balcão digitou; a ação normaliza.
 */
export function FormularioCliente({ cliente, somenteLeitura }: { cliente?: Cliente; somenteLeitura: boolean }) {
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    const formulario = e.currentTarget
    const dados = new FormData(formulario)
    const texto = (nome: string) => String(dados.get(nome) ?? '')
    iniciar(async () => {
      const r = await salvarCliente(
        {
          nome: texto('nome'),
          telefone: texto('telefone'),
          cpf: texto('cpf'),
          email: texto('email'),
          endereco: texto('endereco'),
          nascimento: texto('nascimento'),
        },
        cliente?.id,
      )
      if (!r.ok) return setMsg({ ok: false, texto: r.erro })
      setMsg({ ok: true, texto: cliente ? 'Alterações salvas.' : 'Cliente cadastrado.' })
      if (!cliente) formulario.reset()
    })
  }

  const prefixo = cliente ? 'editar' : 'novo'

  return (
    <form onSubmit={enviar}>
      <fieldset disabled={somenteLeitura} className="flex flex-col gap-4">
        <legend className="sr-only">{cliente ? `Dados de ${cliente.nome}` : 'Novo cliente'}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id={`${prefixo}-nome`}
            name="nome"
            rotulo="Nome"
            marcarObrigatorio
            required
            autoComplete="off"
            defaultValue={cliente?.nome}
          />
          <Campo
            id={`${prefixo}-telefone`}
            name="telefone"
            rotulo="Telefone"
            marcarObrigatorio
            required
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(13) 99999-9999"
            defaultValue={cliente ? formatarTelefone(cliente.telefone) : undefined}
          />
          <Campo
            id={`${prefixo}-cpf`}
            name="cpf"
            rotulo="CPF"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            defaultValue={cliente?.cpf ? formatarCpf(cliente.cpf) : undefined}
          />
          <Campo
            id={`${prefixo}-email`}
            name="email"
            rotulo="E-mail"
            type="email"
            inputMode="email"
            autoComplete="off"
            defaultValue={cliente?.email ?? undefined}
          />
          <Campo
            id={`${prefixo}-endereco`}
            name="endereco"
            rotulo="Endereço"
            autoComplete="off"
            defaultValue={cliente?.endereco ?? undefined}
          />
          <Campo
            id={`${prefixo}-nascimento`}
            name="nascimento"
            rotulo="Nascimento"
            type="date"
            defaultValue={cliente?.nascimento ?? undefined}
          />
        </div>
        <Retorno msg={msg} />
        <div>
          <Botao type="submit" carregando={pendente} rotuloCarregando="Salvando…">
            {cliente ? 'Salvar alterações' : 'Cadastrar cliente'}
          </Botao>
        </div>
      </fieldset>
    </form>
  )
}
