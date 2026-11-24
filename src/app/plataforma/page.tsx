import { Suspense } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { classesBotao } from '@/components/ui/Botao'
import { Selo } from '@/components/ui/Selo'
import { TabelaResponsiva } from '@/components/ui/TabelaResponsiva'
import { listarModulos, SITUACAO, type Situacao } from '@/lib/rotulos'
import { exigirAdminPlataforma } from '@/lib/sessao'
import { criarClienteServidor } from '@/lib/supabase/servidor'
import type { Modulo } from '@/lib/tipos'

export const metadata: Metadata = { title: 'Lojas' }

type Uso = {
  loja_id: string
  nome: string
  plano: string
  modulos: Modulo[]
  situacao: Situacao
  usuarios_ativos: number
  ultimo_acesso: string | null
}

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

export default function Plataforma() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-titulo text-3xl font-bold tracking-tight">Lojas</h1>
        <Link href="/plataforma/lojas/nova" className={classesBotao()}>
          Nova loja
        </Link>
      </div>
      <Suspense fallback={<p className="text-tinta-suave">Carregando lojas…</p>}>
        <ListaLojas />
      </Suspense>
    </div>
  )
}

async function ListaLojas() {
  await exigirAdminPlataforma()
  const supabase = await criarClienteServidor()
  const { data, error } = await supabase.rpc('uso_lojas')
  if (error) return <p role="alert" className="font-medium text-perigo">Não foi possível carregar as lojas. Recarregue a página.</p>

  return (
    <TabelaResponsiva<Uso>
      legenda="Lojas da plataforma e uso"
      linhas={(data ?? []) as Uso[]}
      chave={(l) => l.loja_id}
      vazio="Nenhuma loja ainda. Toque em “Nova loja” para criar a primeira."
      colunas={[
        {
          titulo: 'Loja',
          valor: (l) => (
            <Link href={`/plataforma/lojas/${l.loja_id}`} className="font-semibold text-marca underline-offset-4 hover:underline">
              {l.nome}
            </Link>
          ),
        },
        { titulo: 'Plano', valor: (l) => l.plano },
        { titulo: 'Situação', valor: (l) => <Selo tom={SITUACAO[l.situacao].tom}>{SITUACAO[l.situacao].rotulo}</Selo> },
        { titulo: 'Módulos', valor: (l) => listarModulos(l.modulos) },
        { titulo: 'Usuários ativos', valor: (l) => l.usuarios_ativos, alinhar: 'direita' },
        {
          titulo: 'Último acesso',
          valor: (l) => (l.ultimo_acesso ? dataHora.format(new Date(l.ultimo_acesso)) : 'Nunca entrou'),
        },
      ]}
    />
  )
}
