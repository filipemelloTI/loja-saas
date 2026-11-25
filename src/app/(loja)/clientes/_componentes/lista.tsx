'use client'

import Link from 'next/link'
import { useState, useTransition, type FormEvent } from 'react'
import { Alerta } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { TabelaResponsiva } from '@/components/ui/TabelaResponsiva'
import { formatarTelefone } from '@/lib/formatar'
import { buscarClientes } from '../buscar'
import { LIMITE_LISTA, type ClienteResumo } from '../resumo'

const VAZIO_SEM_BUSCA = 'Nenhum cliente cadastrado ainda. Preencha o formulário abaixo para cadastrar o primeiro.'
const VAZIO_SEM_BUSCA_LEITURA = 'Nenhum cliente cadastrado nesta loja ainda.'
const VAZIO_COM_BUSCA = 'Nenhum cliente encontrado. Confira o nome, o telefone ou o CPF, ou cadastre um novo no formulário abaixo.'
const VAZIO_COM_BUSCA_LEITURA = 'Nenhum cliente encontrado. Confira o nome, o telefone ou o CPF.'

export function ListaClientes({ clientes, somenteLeitura }: { clientes: ClienteResumo[]; somenteLeitura: boolean }) {
  const [termo, setTermo] = useState('')
  const [buscado, setBuscado] = useState<ClienteResumo[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  // Lista nova do servidor (depois de cadastrar alguém): volta para os mais recentes.
  const [anteriores, setAnteriores] = useState(clientes)
  if (anteriores !== clientes) {
    setAnteriores(clientes)
    setBuscado(null)
    setTermo('')
  }

  function buscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    iniciar(async () => {
      try {
        setBuscado(termo.trim() ? await buscarClientes(termo) : null)
      } catch {
        setErro('Não foi possível buscar agora. Tente de novo.')
      }
    })
  }

  const linhas = buscado ?? clientes

  return (
    <div className="flex flex-col gap-4">
      <form role="search" onSubmit={buscar} className="flex items-end gap-2">
        <Campo
          className="min-w-0 flex-1"
          name="busca"
          rotulo="Buscar cliente"
          type="search"
          placeholder="Nome, telefone, CPF ou IMEI"
          autoComplete="off"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
        <Botao type="submit" variante="secundario" carregando={pendente} rotuloCarregando="Buscando…">
          Buscar
        </Botao>
      </form>

      {erro && <Alerta>{erro}</Alerta>}

      <TabelaResponsiva
        legenda="Clientes da loja"
        linhas={linhas}
        chave={(c) => c.id}
        vazio={
          buscado
            ? somenteLeitura ? VAZIO_COM_BUSCA_LEITURA : VAZIO_COM_BUSCA
            : somenteLeitura ? VAZIO_SEM_BUSCA_LEITURA : VAZIO_SEM_BUSCA
        }
        colunas={[
          {
            titulo: 'Nome',
            valor: (c) => (
              <Link href={`/clientes/${c.id}`} className="inline-flex min-h-11 items-center text-marca hover:underline">
                {c.nome}
              </Link>
            ),
          },
          { titulo: 'Telefone', valor: (c) => <span className="numeros">{formatarTelefone(c.telefone)}</span> },
          { titulo: 'Endereço', valor: (c) => c.endereco ?? '—' },
        ]}
      />

      {linhas.length >= LIMITE_LISTA && (
        <p className="text-sm text-tinta-suave">
          {buscado
            ? `Mostrando os primeiros ${LIMITE_LISTA} resultados. Digite mais do nome ou do telefone para afinar.`
            : `Mostrando os ${LIMITE_LISTA} clientes mais recentes. Use a busca para achar os outros.`}
        </p>
      )}
    </div>
  )
}
