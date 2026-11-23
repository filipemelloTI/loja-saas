import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Cabecalho, Carregando } from '../_componentes/comum'
import { PainelSuporte } from '../_componentes/suporte'
import { carregarBase } from '../dados'

export const metadata: Metadata = { title: 'Acesso de suporte' }

export default function PaginaSuporte() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Cabecalho
        titulo="Acesso de suporte"
        sobre="Libere um acesso temporário e somente leitura para o suporte entrar na sua loja e ajudar. Você pode encerrar quando quiser."
      />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  const { supabase, somenteLeitura } = await carregarBase()
  // A RLS limita a leitura à loja do Dono (ou, para o admin em suporte, aos acessos dele).
  const { data } = await supabase
    .from('acessos_suporte')
    .select('expira_em')
    .gt('expira_em', new Date().toISOString())
    .order('expira_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  const expira = (data?.expira_em as string | undefined) ?? null
  const expiraEmTexto = expira
    ? new Date(expira).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
    : null

  return <PainelSuporte vigente={!!expira} expiraEmTexto={expiraEmTexto} somenteLeitura={somenteLeitura} />
}
