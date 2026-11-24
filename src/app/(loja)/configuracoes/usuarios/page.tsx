import { Suspense } from 'react'
import type { Metadata } from 'next'
import type { Perfil } from '@/lib/tipos'
import { Cabecalho, Carregando } from '../_componentes/comum'
import { GerenciarUsuarios, type Usuario } from '../_componentes/usuarios'
import { carregarBase } from '../dados'

export const metadata: Metadata = { title: 'Usuários' }

export default function PaginaUsuarios() {
  return (
    <div className="flex flex-col gap-6">
      <Cabecalho
        titulo="Usuários"
        sobre="Cada pessoa entra com o próprio e-mail. O perfil define o que ela vê; custo e comissão são só do Dono."
      />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  const { supabase, lojaId, somenteLeitura } = await carregarBase()
  const [membros, comissoes, loja] = await Promise.all([
    supabase.from('membros').select('id, nome, perfil, ativo').eq('loja_id', lojaId).order('criado_em'),
    supabase.from('comissoes_membro').select('membro_id, percentual').eq('loja_id', lojaId),
    supabase.from('lojas').select('plano_id').eq('id', lojaId).maybeSingle(),
  ])
  const { data: plano } = loja.data
    ? await supabase.from('planos').select('limite_usuarios').eq('id', loja.data.plano_id).maybeSingle()
    : { data: null }

  const percentual = new Map((comissoes.data ?? []).map((c) => [c.membro_id as string, Number(c.percentual)]))
  const usuarios: Usuario[] = (membros.data ?? []).map((m) => ({
    id: m.id,
    nome: m.nome,
    perfil: m.perfil as Perfil,
    ativo: m.ativo,
    comissao: percentual.get(m.id) ?? null,
  }))

  return (
    <GerenciarUsuarios
      usuarios={usuarios}
      limite={plano?.limite_usuarios ?? null}
      somenteLeitura={somenteLeitura}
    />
  )
}
