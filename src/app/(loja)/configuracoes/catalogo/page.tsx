import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Cabecalho, Carregando } from '../_componentes/comum'
import { GerenciarCatalogo, type Servico } from '../_componentes/catalogo'
import { carregarBase } from '../dados'

export const metadata: Metadata = { title: 'Catálogo de serviços' }

export default function PaginaCatalogo() {
  return (
    <div className="flex flex-col gap-6">
      <Cabecalho
        titulo="Catálogo de serviços"
        sobre="O custo estimado da peça e a margem só aparecem para o Dono. Técnico e atendente veem só nome e preço."
      />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  const { supabase, lojaId, somenteLeitura } = await carregarBase()
  const [servicos, custos, config] = await Promise.all([
    supabase.from('servicos').select('id, nome, preco, garantia_dias, ativo').eq('loja_id', lojaId).order('nome'),
    supabase.from('servicos_custo').select('servico_id, custo_peca_estimado').eq('loja_id', lojaId),
    supabase.from('config_loja').select('garantia_servico_dias').eq('loja_id', lojaId).maybeSingle(),
  ])
  const custo = new Map((custos.data ?? []).map((c) => [c.servico_id as string, Number(c.custo_peca_estimado)]))
  const lista: Servico[] = (servicos.data ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    preco: Number(s.preco),
    custo: custo.get(s.id) ?? 0,
    garantiaDias: s.garantia_dias,
    ativo: s.ativo,
  }))

  return (
    <GerenciarCatalogo
      servicos={lista}
      garantiaPadrao={config.data?.garantia_servico_dias ?? 90}
      somenteLeitura={somenteLeitura}
    />
  )
}
