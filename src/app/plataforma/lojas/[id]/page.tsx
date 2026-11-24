import { Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Cartao } from '@/components/ui/Cartao'
import { Selo } from '@/components/ui/Selo'
import { donoDaLoja } from '@/lib/plataforma'
import { SITUACAO, type Situacao } from '@/lib/rotulos'
import { exigirAdminPlataforma } from '@/lib/sessao'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { Modulo } from '@/lib/tipos'
import { FormularioLoja, LinkDono } from '../../componentes'
import { carregarPlanos } from '../../dados'
import { EntrarComoSuporte } from './suporte'

export const metadata: Metadata = { title: 'Loja' }

export default function DetalheLoja({ params }: PageProps<'/plataforma/lojas/[id]'>) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/plataforma" className="text-sm font-semibold text-marca hover:underline">
        ← Lojas
      </Link>
      <Suspense fallback={<p className="text-tinta-suave">Carregando…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </div>
  )
}

async function Conteudo({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdminPlataforma()
  const { id } = await params
  const supabase = await criarClienteServidor()
  // Só o cadastro da loja (plano, módulos, situação). Nada dos dados internos dela.
  const { data: loja } = await supabase
    .from('lojas')
    .select('id, nome, plano_id, modulos, situacao')
    .eq('id', id)
    .maybeSingle()
  if (!loja) notFound()

  const [planos, dono] = await Promise.all([carregarPlanos(), donoDaLoja(criarClienteAdmin(), id)])
  const situacao = SITUACAO[loja.situacao as Situacao]

  // Acesso de suporte vigente desta loja (o admin lê todos pela RLS; o mais recente vale).
  const { data: suporte } = await supabase
    .from('acessos_suporte')
    .select('expira_em')
    .eq('loja_id', id)
    .gt('expira_em', new Date().toISOString())
    .order('expira_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  const suporteExpira = (suporte?.expira_em as string | undefined) ?? null
  const suporteTexto = suporteExpira
    ? new Date(suporteExpira).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
    : null

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-titulo text-3xl font-bold tracking-tight">{loja.nome}</h1>
        <Selo tom={situacao.tom}>{situacao.rotulo}</Selo>
      </div>
      <FormularioLoja
        loja={{ ...loja, modulos: loja.modulos as Modulo[], situacao: loja.situacao as Situacao }}
        planos={planos}
      />
      <Cartao titulo="Senha do Dono">
        <LinkDono lojaId={loja.id} dono={dono} />
      </Cartao>
      <Cartao titulo="Acesso de suporte">
        <EntrarComoSuporte vigente={!!suporteExpira} expiraEmTexto={suporteTexto} />
      </Cartao>
    </>
  )
}
