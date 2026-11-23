import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Cabecalho, Carregando } from '../_componentes/comum'
import { FormularioChecklist } from '../_componentes/checklist'
import { carregarBase } from '../dados'

export const metadata: Metadata = { title: 'Checklist de avarias' }

export default function PaginaChecklist() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Cabecalho
        titulo="Checklist de avarias"
        sobre="Conferido na entrada do aparelho, na ordem desta lista. Item desativado não aparece nas próximas OS."
      />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  const { supabase, lojaId, somenteLeitura } = await carregarBase()
  const { data } = await supabase.from('checklist_itens').select('id, nome, ativo').eq('loja_id', lojaId).order('ordem')
  return <FormularioChecklist itens={data ?? []} somenteLeitura={somenteLeitura} />
}
