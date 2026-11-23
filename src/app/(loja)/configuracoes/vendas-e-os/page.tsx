import { Suspense } from 'react'
import type { Metadata } from 'next'
import type { FormaPagamento } from '@/lib/rotulos'
import { Cabecalho, Carregando } from '../_componentes/comum'
import { FormularioVendasOS } from '../_componentes/vendas-e-os'
import { carregarBase } from '../dados'

export const metadata: Metadata = { title: 'Vendas e OS' }

export default function PaginaVendasOS() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Cabecalho titulo="Vendas e OS" />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  const { supabase, lojaId, somenteLeitura } = await carregarBase()
  const { data: c } = await supabase
    .from('config_loja')
    .select(
      'orcamento_alerta_dias, taxa_avaliacao_ativa, taxa_avaliacao_valor, os_numero_inicial, venda_numero_inicial, ' +
        'formas_pagamento, dono_gera_comissao, tecnico_ve_propria_comissao',
    )
    .eq('loja_id', lojaId)
    .maybeSingle<{
      orcamento_alerta_dias: number
      taxa_avaliacao_ativa: boolean
      taxa_avaliacao_valor: number
      os_numero_inicial: number
      venda_numero_inicial: number
      formas_pagamento: string[]
      dono_gera_comissao: boolean
      tecnico_ve_propria_comissao: boolean
    }>()
  if (!c) return <p className="text-tinta-suave">Configuração da loja não encontrada.</p>

  return (
    <FormularioVendasOS
      somenteLeitura={somenteLeitura}
      inicial={{
        orcamentoAlertaDias: c.orcamento_alerta_dias,
        taxaAvaliacaoAtiva: c.taxa_avaliacao_ativa,
        taxaAvaliacaoValor: Number(c.taxa_avaliacao_valor),
        osNumeroInicial: c.os_numero_inicial,
        vendaNumeroInicial: c.venda_numero_inicial,
        formasPagamento: c.formas_pagamento as FormaPagamento[],
        donoGeraComissao: c.dono_gera_comissao,
        tecnicoVePropriaComissao: c.tecnico_ve_propria_comissao,
      }}
    />
  )
}
