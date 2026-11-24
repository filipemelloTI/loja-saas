import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Cabecalho, Carregando } from '../_componentes/comum'
import { FormularioCondicoes, FormularioPrazos } from '../_componentes/garantia'
import { carregarBase } from '../dados'

export const metadata: Metadata = { title: 'Garantia' }

export default function PaginaGarantia() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Cabecalho titulo="Garantia" sobre="Prazos usados quando o serviço ou a venda não têm um prazo próprio." />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  const { supabase, lojaId, somenteLeitura } = await carregarBase()
  const [config, condicoes] = await Promise.all([
    supabase
      .from('config_loja')
      .select('garantia_servico_dias, garantia_novo_dias, garantia_seminovo_dias, garantia_acessorio_dias')
      .eq('loja_id', lojaId)
      .maybeSingle(),
    supabase.from('condicoes_garantia').select('id, texto').eq('loja_id', lojaId).order('ordem'),
  ])
  const c = config.data

  return (
    <>
      <FormularioPrazos
        somenteLeitura={somenteLeitura}
        inicial={{
          garantiaServicoDias: c?.garantia_servico_dias ?? 90,
          garantiaNovoDias: c?.garantia_novo_dias ?? 365,
          garantiaSeminovoDias: c?.garantia_seminovo_dias ?? 90,
          garantiaAcessorioDias: c?.garantia_acessorio_dias ?? 90,
        }}
      />
      <FormularioCondicoes condicoes={condicoes.data ?? []} somenteLeitura={somenteLeitura} />
    </>
  )
}
