'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Alerta, Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { Selo } from '@/components/ui/Selo'
import { TabelaResponsiva } from '@/components/ui/TabelaResponsiva'
import { formatarMargem, formatarReais, lerReais } from '@/lib/dinheiro'
import { alternarServico, salvarServico } from '../acoes'
import type { Msg } from './comum'

export type Servico = { id: string; nome: string; preco: number; custo: number; garantiaDias: number | null; ativo: boolean }

const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`
const paraCampo = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Props = { servicos: Servico[]; garantiaPadrao: number; somenteLeitura: boolean }

export function GerenciarCatalogo({ servicos, garantiaPadrao, somenteLeitura }: Props) {
  // null: formulário fechado; 'novo' ou o id do serviço em edição.
  const [aberto, setAberto] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const emEdicao = servicos.find((s) => s.id === aberto)

  function alternar(s: Servico) {
    setErro(null)
    iniciar(async () => {
      const r = await alternarServico(s.id, !s.ativo)
      if (!r.ok) setErro(r.erro)
    })
  }

  return (
    <>
      <div>
        <Botao onClick={() => setAberto('novo')} disabled={somenteLeitura}>
          Adicionar serviço
        </Botao>
      </div>

      {aberto && (
        <Cartao titulo={emEdicao ? `Editar ${emEdicao.nome}` : 'Novo serviço'}>
          <FormularioServico
            key={aberto}
            servico={emEdicao}
            garantiaPadrao={garantiaPadrao}
            somenteLeitura={somenteLeitura}
            aoFechar={() => setAberto(null)}
          />
        </Cartao>
      )}

      {erro && <Alerta>{erro}</Alerta>}

      <TabelaResponsiva
        legenda="Serviços da loja"
        linhas={servicos}
        chave={(s) => s.id}
        vazio="Nenhum serviço ainda. Cadastre os consertos que a loja faz, com preço e custo da peça."
        colunas={[
          { titulo: 'Serviço', valor: (s) => s.nome },
          { titulo: 'Preço', valor: (s) => formatarReais(s.preco), alinhar: 'direita' },
          { titulo: 'Custo estimado', valor: (s) => formatarReais(s.custo), alinhar: 'direita' },
          { titulo: 'Margem', valor: (s) => formatarMargem(s.preco, s.custo), alinhar: 'direita' },
          { titulo: 'Garantia', valor: (s) => (s.garantiaDias === null ? `${dias(garantiaPadrao)} (padrão)` : dias(s.garantiaDias)) },
          { titulo: 'Situação', valor: (s) => (s.ativo ? <Selo tom="info">Ativo</Selo> : <Selo>Desativado</Selo>) },
          {
            titulo: 'Ações',
            valor: (s) => (
              <div className="-my-2 flex flex-wrap gap-1">
                <Botao variante="discreto" onClick={() => setAberto(s.id)} aria-label={`Editar ${s.nome}`}>
                  Editar
                </Botao>
                <Botao
                  variante="discreto"
                  onClick={() => alternar(s)}
                  disabled={pendente || somenteLeitura}
                  aria-label={`${s.ativo ? 'Desativar' : 'Ativar'} ${s.nome}`}
                >
                  {s.ativo ? 'Desativar' : 'Ativar'}
                </Botao>
              </div>
            ),
          },
        ]}
      />
    </>
  )
}

type PropsFormulario = { servico?: Servico; garantiaPadrao: number; somenteLeitura: boolean; aoFechar: () => void }

function FormularioServico({ servico, garantiaPadrao, somenteLeitura, aoFechar }: PropsFormulario) {
  const [nome, setNome] = useState(servico?.nome ?? '')
  const [preco, setPreco] = useState(servico ? paraCampo(servico.preco) : '')
  const [custo, setCusto] = useState(servico ? paraCampo(servico.custo) : '')
  const [garantia, setGarantia] = useState(servico?.garantiaDias === null || !servico ? '' : String(servico.garantiaDias))
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()

  const precoN = lerReais(preco)
  const custoN = lerReais(custo)
  const temMargem = Number.isFinite(precoN) && Number.isFinite(custoN)

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    iniciar(async () => {
      const r = await salvarServico({
        id: servico?.id,
        nome,
        preco: precoN,
        custo: custoN,
        garantiaDias: garantia.trim() === '' ? undefined : Number(garantia),
      })
      if (!r.ok) return setMsg({ ok: false, texto: r.erro })
      if (servico) setMsg({ ok: true, texto: 'Serviço salvo.' })
      else aoFechar()
    })
  }

  return (
    <form onSubmit={enviar}>
      <fieldset disabled={somenteLeitura} className="flex flex-col gap-4">
        <legend className="sr-only">Dados do serviço</legend>
        <Campo id="servico-nome" name="nome" rotulo="Nome do serviço" required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            id="servico-preco"
            name="preco"
            rotulo="Preço (R$)"
            inputMode="decimal"
            required
            placeholder="0,00"
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
          />
          <Campo
            id="servico-custo"
            name="custo"
            rotulo="Custo estimado da peça (R$)"
            inputMode="decimal"
            required
            placeholder="0,00"
            value={custo}
            onChange={(e) => setCusto(e.target.value)}
          />
          <Campo
            id="servico-garantia"
            name="garantiaDias"
            rotulo="Garantia (dias)"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder={String(garantiaPadrao)}
            dica="Em branco: usa o padrão da loja."
            value={garantia}
            onChange={(e) => setGarantia(e.target.value)}
          />
        </div>
        <p className="text-tinta" aria-live="polite">
          Margem: <strong className="numeros">{temMargem ? formatarMargem(precoN, custoN) : '—'}</strong>
        </p>
        <Retorno msg={msg} />
        <div className="flex flex-wrap gap-2">
          <Botao type="submit" disabled={pendente}>
            {pendente ? 'Salvando…' : servico ? 'Salvar serviço' : 'Cadastrar serviço'}
          </Botao>
          <Botao variante="discreto" onClick={aoFechar}>
            {servico ? 'Fechar' : 'Cancelar'}
          </Botao>
        </div>
      </fieldset>
    </form>
  )
}
