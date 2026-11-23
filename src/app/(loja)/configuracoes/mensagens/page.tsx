import { Suspense } from 'react'
import type { Metadata } from 'next'
import { EVENTOS, type Evento } from '@/lib/mensagens'
import { Cabecalho, Carregando } from '../_componentes/comum'
import { EditorMensagem } from '../_componentes/mensagens'
import { carregarBase } from '../dados'

export const metadata: Metadata = { title: 'Mensagens do WhatsApp' }

export default function PaginaMensagens() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Cabecalho
        titulo="Mensagens do WhatsApp"
        sobre="O texto enviado ao cliente em cada etapa. As palavras entre chaves, como {cliente}, são trocadas pelos dados da OS."
      />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  const { supabase, lojaId, somenteLeitura } = await carregarBase()
  const { data } = await supabase.from('mensagens_padrao').select('evento, texto').eq('loja_id', lojaId)
  const texto = new Map((data ?? []).map((m) => [m.evento as Evento, m.texto as string]))

  return (
    <>
      {EVENTOS.filter((e) => texto.has(e)).map((e) => (
        <EditorMensagem key={e} evento={e} texto={texto.get(e)!} somenteLeitura={somenteLeitura} />
      ))}
    </>
  )
}
